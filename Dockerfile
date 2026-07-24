# AgentOS in Docker
#
# Builds the upstream AgentOS web UI (https://github.com/saadnvd1/agent-os)
# into a self-contained image and runs it in the foreground as a non-root user.

FROM node:20-bookworm-slim

# Which ref of the upstream repo to build. Pinned to a specific commit SHA so
# our build-time codegen patches (inject-*.mjs) keep matching the source they
# were written against — a moving target like `main` could refactor a patched
# file and break an anchor check on some future rebuild. Bump this deliberately
# (and re-verify the injectors) when you want newer upstream changes. Accepts a
# commit SHA, tag, or branch; override with:
#   docker compose build --build-arg AGENT_OS_REF=v0.2.1
ARG AGENT_OS_REF=378069fed63708179ae4dd9ddad1a2ce64f37d5d

# ---- System dependencies AgentOS needs at runtime ----
# tmux: drives the terminal sessions  |  ripgrep: code search
# git/openssh: cloning & git integration  |  procps: process management for tmux
# gosu: drop from root to the agent user after remapping its UID/GID at startup
# jq: JSON processor used by the autopilotagent CLI to read task status
# unzip: extract the self-hosted JetBrains Mono webfont at build time
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        gosu \
        jq \
        less \
        openssh-client \
        procps \
        ripgrep \
        tmux \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# ---- Docker CLI (for Docker-out-of-Docker) ----
# Install only the CLI — agents talk to the host daemon via a mounted socket.
# KEPT IN ITS OWN LAYER so the apt signing key + source list are separate from
# the system deps above. Skipped entirely when ENABLE_DOCKER is false/unset.
# Override ENABLE_DOCKER: docker compose build --build-arg ENABLE_DOCKER=true
ARG ENABLE_DOCKER=true
RUN if [ "${ENABLE_DOCKER}" = "true" ]; then \
        set -eux; \
        install -m 0755 -d /etc/apt/keyrings; \
        curl -fsSL https://download.docker.com/linux/debian/gpg \
            -o /etc/apt/keyrings/docker.asc; \
        chmod a+r /etc/apt/keyrings/docker.asc; \
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
            > /etc/apt/sources.list.d/docker.list; \
        apt-get update; \
        apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin; \
        rm -rf /var/lib/apt/lists/*; \
    fi

# ---- GitHub CLI (gh) ----
# Installed from GitHub's official apt repo so the binary lives in /usr/bin
# (root-owned, like the other tools) and ships with every build. Kept in its own
# layer because it needs the repo's signing key + source list added first.
# Gated by INSTALL_GH (default true): set false to skip it (no runtime code
# depends on `gh` — it's purely for interactive PR/issue/auth use).
ARG INSTALL_GH=true
RUN set -eux; \
    if [ "${INSTALL_GH}" = "true" ]; then \
        mkdir -p -m 755 /etc/apt/keyrings; \
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
             -o /etc/apt/keyrings/githubcli-archive-keyring.gpg; \
        chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg; \
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
             > /etc/apt/sources.list.d/github-cli.list; \
        apt-get update; \
        apt-get install -y --no-install-recommends gh; \
        rm -rf /var/lib/apt/lists/*; \
    fi

# ---- Bun (JS runtime / package manager) ----
# Single binary via the official installer. Land it under /usr/local (not
# ~/.bun) so it stays on PATH for the non-root agent user and isn't shadowed by
# the persisted home volume. unzip is already in the system-deps layer above
# (required by the installer). Gated by INSTALL_BUN (default true): set false
# to skip, e.g. docker compose build --build-arg INSTALL_BUN=false.
ARG INSTALL_BUN=true
RUN set -eux; \
    if [ "${INSTALL_BUN}" = "true" ]; then \
        curl -fsSL https://bun.com/install | BUN_INSTALL=/usr/local bash; \
        bun --version; \
    fi

# ---- Pre-install the AI coding agents AgentOS can drive ----
# Each agent is individually gated so you don't ship (and wait on) CLIs you'll
# never use. All default to true = installed; set any to "false" via build arg
# (surfaced in docker-compose.yml / .env) to skip it, e.g.
#   docker compose build --build-arg INSTALL_CODEX=false
# We assemble the package list first, then do a single `npm install -g`, so
# skipping some still shares one layer. `if` blocks (not `[ ] &&`) keep this
# safe under `set -e`. Note: skipping Claude Code disables the `claude`/`claude-*`
# harnesses (and the profile wrappers become no-ops), so leave it on unless you
# only drive the other agents.
ARG INSTALL_CLAUDE_CODE=true
ARG INSTALL_CODEX=true
ARG INSTALL_OPENCODE=true
ARG INSTALL_COMMAND_CODE=true
ARG INSTALL_ZERO=true
RUN set -eux; \
    pkgs=""; \
    if [ "${INSTALL_CLAUDE_CODE}" = "true" ]; then pkgs="${pkgs} @anthropic-ai/claude-code"; fi; \
    if [ "${INSTALL_CODEX}" = "true" ]; then pkgs="${pkgs} @openai/codex"; fi; \
    if [ "${INSTALL_OPENCODE}" = "true" ]; then pkgs="${pkgs} opencode-ai"; fi; \
    if [ "${INSTALL_COMMAND_CODE}" = "true" ]; then pkgs="${pkgs} command-code"; fi; \
    if [ "${INSTALL_ZERO}" = "true" ]; then pkgs="${pkgs} @gitlawb/zero"; fi; \
    if [ -n "${pkgs}" ]; then npm install -g ${pkgs} && npm cache clean --force; fi

# ---- Headless browser for AI-agent frontend verification ----
# Agents building web UIs need a real browser to render + screenshot their
# changes. Chromium depends on a pile of system libraries (libglib, libnss3,
# libatk, ...) that require root + apt to install — impossible at runtime, where
# the agent runs as the non-root `agent` user (uid 1001, no sudo). So we bake it
# in here, at build time, as root: `playwright install --with-deps chromium`
# apt-installs those OS libs AND downloads a matching Chromium build. We point
# PLAYWRIGHT_BROWSERS_PATH at a shared dir under /opt (root-owned but
# world-readable, like our other build artifacts) so any agent UID — even after
# the entrypoint remaps it to PUID/PGID — can launch it; the a+rX chmod
# guarantees the read/traverse/execute bits regardless of the umask playwright
# unpacked with. `playwright` is also installed globally so `npx playwright` and
# `require('playwright')`-style scripts resolve without a per-project install
# (and reuse this shared browser instead of re-downloading it). Pinned so the
# Chromium build and the driving `playwright` package always match; its own
# layer so bumping the version doesn't invalidate the agent installs above.
# Gated by INSTALL_BROWSER (default true): set it false to skip Chromium + its
# ~few-hundred-MB of libraries if your agents never verify frontends visually,
# e.g. `docker compose build --build-arg INSTALL_BROWSER=false`. We keep
# PLAYWRIGHT_BROWSERS_PATH exported either way (harmless when unused).
# Override the pinned version with --build-arg PLAYWRIGHT_VERSION=<x.y.z>.
ARG INSTALL_BROWSER=true
ARG PLAYWRIGHT_VERSION=1.61.1
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN set -eux; \
    if [ "${INSTALL_BROWSER}" = "true" ]; then \
        npm install -g "playwright@${PLAYWRIGHT_VERSION}"; \
        playwright install --with-deps chromium; \
        chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}"; \
        npm cache clean --force; \
        rm -rf /var/lib/apt/lists/*; \
    fi

# ---- Build AgentOS from source ----
# We build into /opt (outside the persisted home volume) so that rebuilding
# the image always ships fresh build artifacts instead of being shadowed by an
# old named volume.
ENV AGENT_OS_REPO=/opt/agent-os

# Fetch the pinned ref + install deps. Kept separate so it stays cached when
# only the profile list (CLAUDE_PROFILES) changes. We fetch by ref instead of
# `git clone --branch` because that flag rejects a bare commit SHA — fetching a
# single ref shallow handles a SHA, tag, or branch uniformly. Because the ref is
# pinned, this layer is fully deterministic and Docker's cache stays valid until
# AGENT_OS_REF actually changes (no clone-cache-busting needed).
RUN git init "${AGENT_OS_REPO}" \
    && cd "${AGENT_OS_REPO}" \
    && git remote add origin https://github.com/saadnvd1/agent-os \
    && git fetch --depth 1 origin "${AGENT_OS_REF}" \
    && git checkout --detach FETCH_HEAD \
    && npm install --legacy-peer-deps

# ---- Self-hosted JetBrains Mono webfont ----
# The terminal and UI code blocks render in JetBrains Mono. Upstream's xterm
# fontFamily already lists it first, but the font isn't shipped — so without
# this it silently falls back to a system monospace. We fetch the official
# release (which provides ready-made woff2 webfonts, ~92KB each) and drop just
# the weights we use into the app's public/fonts dir, served by the custom
# server at runtime — no runtime CDN dependency. inject-jetbrains-mono-font.mjs
# adds the @font-face rules + the --font-mono token that reference these files.
# Pinned to a release tag for reproducibility; its own layer so it stays cached
# unless JETBRAINS_MONO_REF changes. Override with --build-arg JETBRAINS_MONO_REF=<tag>.
# Gated by INSTALL_JETBRAINS_MONO_FONT (default true): set false to skip the
# download AND its injector step below, leaving the terminal/code font on the
# system-monospace fallback. Declared here so it's in scope for the build RUN too.
ARG INSTALL_JETBRAINS_MONO_FONT=true
ARG JETBRAINS_MONO_REF=v2.304
RUN set -eux; \
    if [ "${INSTALL_JETBRAINS_MONO_FONT}" = "true" ]; then \
        tmp="$(mktemp -d)"; \
        ver="${JETBRAINS_MONO_REF#v}"; \
        curl -fsSL "https://github.com/JetBrains/JetBrainsMono/releases/download/${JETBRAINS_MONO_REF}/JetBrainsMono-${ver}.zip" \
            -o "${tmp}/jbm.zip"; \
        dest="${AGENT_OS_REPO}/public/fonts"; mkdir -p "${dest}"; \
        for w in Regular Italic SemiBold Bold BoldItalic; do \
            unzip -q -o -j "${tmp}/jbm.zip" "fonts/webfonts/JetBrainsMono-${w}.woff2" -d "${dest}"; \
        done; \
        rm -rf "${tmp}"; \
    fi

# Register the configured Claude profiles as selectable harnesses in the UI,
# bake the terminal font size into the bundle, and apply our downstream UI
# patches, then build. Declared here (after install) so changing these only
# re-runs codegen + build, not the slow clone + npm install above. The xterm.js
# font size is compiled into the client bundle, so it can't be changed at
# runtime — patch it at build time instead.
ARG CLAUDE_PROFILES="a b c"
ARG TERMINAL_FONT_SIZE=16
ARG TERMINAL_FONT_SIZE_MOBILE=13
COPY patches/inject-claude-profiles.mjs /tmp/inject-claude-profiles.mjs
COPY patches/inject-commandcode-provider.mjs /tmp/inject-commandcode-provider.mjs
COPY patches/inject-terminal-font.mjs /tmp/inject-terminal-font.mjs
COPY patches/inject-mobile-viewport-fix.mjs /tmp/inject-mobile-viewport-fix.mjs
COPY patches/inject-terminal-toolbar-keys.mjs /tmp/inject-terminal-toolbar-keys.mjs
COPY patches/inject-session-rename-fix.mjs /tmp/inject-session-rename-fix.mjs
COPY patches/inject-jetbrains-mono-font.mjs /tmp/inject-jetbrains-mono-font.mjs
COPY patches/inject-safe-area-top-fix.mjs /tmp/inject-safe-area-top-fix.mjs
COPY patches/inject-pwa-theme-color.mjs /tmp/inject-pwa-theme-color.mjs
COPY patches/inject-mobile-drawer-safearea.mjs /tmp/inject-mobile-drawer-safearea.mjs
COPY patches/inject-raster-favicon.mjs /tmp/inject-raster-favicon.mjs
COPY patches/inject-toolbar-uniform-buttons.mjs /tmp/inject-toolbar-uniform-buttons.mjs
COPY patches/inject-ui-font-inter.mjs /tmp/inject-ui-font-inter.mjs
COPY patches/inject-remove-ctrl-d.mjs /tmp/inject-remove-ctrl-d.mjs
COPY patches/inject-toolbar-key-repeat.mjs /tmp/inject-toolbar-key-repeat.mjs
COPY patches/inject-zero-provider.mjs /tmp/inject-zero-provider.mjs
RUN cd "${AGENT_OS_REPO}" \
    && CLAUDE_PROFILES="${CLAUDE_PROFILES}" node /tmp/inject-claude-profiles.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-commandcode-provider.mjs "${AGENT_OS_REPO}" \
    && TERMINAL_FONT_SIZE="${TERMINAL_FONT_SIZE}" \
       TERMINAL_FONT_SIZE_MOBILE="${TERMINAL_FONT_SIZE_MOBILE}" \
       node /tmp/inject-terminal-font.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-mobile-viewport-fix.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-terminal-toolbar-keys.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-session-rename-fix.mjs "${AGENT_OS_REPO}" \
    && if [ "${INSTALL_JETBRAINS_MONO_FONT}" = "true" ]; then \
           node /tmp/inject-jetbrains-mono-font.mjs "${AGENT_OS_REPO}"; \
       fi \
    && node /tmp/inject-safe-area-top-fix.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-pwa-theme-color.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-mobile-drawer-safearea.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-raster-favicon.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-toolbar-uniform-buttons.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-ui-font-inter.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-remove-ctrl-d.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-toolbar-key-repeat.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-zero-provider.mjs "${AGENT_OS_REPO}" \
    && npm run build \
    && npm cache clean --force

# ---- autopilotagent (multi-agent TDD workflow: Claude/Codex/OpenCode/cmd) ----
# Baked into /opt (root-owned, world-readable) so it's NOT shadowed by the
# persisted home volume — the entrypoint symlinks commands/skills/hooks/CLIs
# into every agent home (~/.claude, ~/.codex, ~/.agents/skills, …) at runtime,
# which is the only place that reliably writes into the volume regardless of
# its age. Placed after the agent-os build so bumping AUTOPILOT_REF doesn't
# invalidate that layer. Defaults to `multi-agent-support` (latest on each
# rebuild): unlike AGENT_OS_REF there are no source-anchored patches against
# this repo, so tracking the branch is safe.
# Override with: docker compose build --build-arg AUTOPILOT_REF=<sha|tag|branch>
# Gated by INSTALL_AUTOPILOT (default true): set false to skip the clone. The
# entrypoint already guards its install with `if [ -d "${AUTOPILOT_REPO}" ]`, so
# skipping it here degrades gracefully — sessions just won't have /autopilotagent.
ARG INSTALL_AUTOPILOT=true
ARG AUTOPILOT_REF=multi-agent-support
ENV AUTOPILOT_REPO=/opt/autopilot-multi
RUN set -eux; \
    if [ "${INSTALL_AUTOPILOT}" = "true" ]; then \
        git init "${AUTOPILOT_REPO}"; \
        cd "${AUTOPILOT_REPO}"; \
        git remote add origin https://github.com/thaqiif/autopilot-multi; \
        git fetch --depth 1 origin "${AUTOPILOT_REF}"; \
        git checkout --detach FETCH_HEAD; \
    fi

# ---- Non-root runtime user ----
# Pre-create the home subdirectories that docker-compose mounts as named
# volumes so the volumes inherit the agent user's ownership on first run.
# The agent user's UID/GID here are just defaults — the entrypoint remaps them
# at startup to PUID/PGID so files on bind-mounted host folders get the right
# owner. Build artifacts in /opt stay root-owned but world-readable.
RUN useradd --create-home --shell /bin/bash --uid 1001 agent \
    && mkdir -p \
        /home/agent/.agent-os \
        /home/agent/.agents/skills \
        /home/agent/.config/opencode \
        /home/agent/.claude \
        /home/agent/.claude-profiles \
        /home/agent/.codex \
        /home/agent/.commandcode \
        /home/agent/.ssh \
        /home/agent/.gitstate \
        /home/agent/.local/bin \
        /workspaces \
    && chmod 700 /home/agent/.ssh \
    && chown -R agent:agent /home/agent

ENV HOME=/home/agent \
    AGENT_OS_HOME=/home/agent/.agent-os \
    AGENT_OS_PORT=3011 \
    # AgentOS' SQLite DB (projects, sessions, messages) defaults to
    # <cwd>/agent-os.db, i.e. /opt/agent-os/agent-os.db — which lives in the
    # image build dir and gets wiped on every rebuild. Relocate it into the
    # persisted home volume so projects and session history survive redeploys.
    DB_PATH=/home/agent/.agent-os/agent-os.db \
    NODE_ENV=production \
    PATH=/home/agent/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin \
    # Relocate git's global config into a persisted volume so logins (HTTPS
    # credentials via the store helper) AND user.name/user.email survive a
    # container recreation. The matching credentials file lives in the same dir.
    GIT_CONFIG_GLOBAL=/home/agent/.gitstate/config \
    # UID/GID the container process runs as. Set these to match the owner of your
    # host workspace folder (run `id` on the host) so files are read/writable.
    PUID=1000 \
    PGID=1000 \
    # Extra Claude Code profiles, each with isolated auth/config. Generates
    # claude-a, claude-b, ... wrappers at runtime; the matching UI harnesses are
    # baked in at build time from the CLAUDE_PROFILES build arg above (which is
    # why changing this list needs a rebuild: `docker compose up -d --build`).
    CLAUDE_PROFILES=${CLAUDE_PROFILES}

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Entrypoint starts as root to remap the user, then drops to agent via gosu.
WORKDIR /opt/agent-os

EXPOSE 3011

ENTRYPOINT ["docker-entrypoint.sh"]
