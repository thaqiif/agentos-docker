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
# jq: JSON processor used by the autopilot-multi CLI to read task status
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

# ---- GitHub CLI (gh) ----
# Installed from GitHub's official apt repo so the binary lives in /usr/bin
# (root-owned, like the other tools) and ships with every build. Kept in its own
# layer because it needs the repo's signing key + source list added first.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
         -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
         > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# ---- Pre-install the AI coding agents AgentOS can drive ----
RUN npm install -g \
        @anthropic-ai/claude-code \
        @openai/codex \
        opencode-ai \
    && npm cache clean --force

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
ARG JETBRAINS_MONO_REF=v2.304
RUN set -eux; \
    tmp="$(mktemp -d)"; \
    ver="${JETBRAINS_MONO_REF#v}"; \
    curl -fsSL "https://github.com/JetBrains/JetBrainsMono/releases/download/${JETBRAINS_MONO_REF}/JetBrainsMono-${ver}.zip" \
        -o "${tmp}/jbm.zip"; \
    dest="${AGENT_OS_REPO}/public/fonts"; mkdir -p "${dest}"; \
    for w in Regular Italic SemiBold Bold BoldItalic; do \
        unzip -q -o -j "${tmp}/jbm.zip" "fonts/webfonts/JetBrainsMono-${w}.woff2" -d "${dest}"; \
    done; \
    rm -rf "${tmp}"

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
COPY patches/inject-terminal-font.mjs /tmp/inject-terminal-font.mjs
COPY patches/inject-mobile-viewport-fix.mjs /tmp/inject-mobile-viewport-fix.mjs
COPY patches/inject-terminal-toolbar-keys.mjs /tmp/inject-terminal-toolbar-keys.mjs
COPY patches/inject-session-rename-fix.mjs /tmp/inject-session-rename-fix.mjs
COPY patches/inject-jetbrains-mono-font.mjs /tmp/inject-jetbrains-mono-font.mjs
COPY patches/inject-safe-area-top-fix.mjs /tmp/inject-safe-area-top-fix.mjs
COPY patches/inject-pwa-theme-color.mjs /tmp/inject-pwa-theme-color.mjs
COPY patches/inject-mobile-drawer-safearea.mjs /tmp/inject-mobile-drawer-safearea.mjs
COPY patches/inject-raster-favicon.mjs /tmp/inject-raster-favicon.mjs
COPY patches/inject-mobile-toolbar-safearea.mjs /tmp/inject-mobile-toolbar-safearea.mjs
RUN cd "${AGENT_OS_REPO}" \
    && CLAUDE_PROFILES="${CLAUDE_PROFILES}" node /tmp/inject-claude-profiles.mjs "${AGENT_OS_REPO}" \
    && TERMINAL_FONT_SIZE="${TERMINAL_FONT_SIZE}" \
       TERMINAL_FONT_SIZE_MOBILE="${TERMINAL_FONT_SIZE_MOBILE}" \
       node /tmp/inject-terminal-font.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-mobile-viewport-fix.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-terminal-toolbar-keys.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-session-rename-fix.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-jetbrains-mono-font.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-safe-area-top-fix.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-pwa-theme-color.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-mobile-drawer-safearea.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-raster-favicon.mjs "${AGENT_OS_REPO}" \
    && node /tmp/inject-mobile-toolbar-safearea.mjs "${AGENT_OS_REPO}" \
    && npm run build \
    && npm cache clean --force

# ---- autopilot-multi (TDD workflow commands/hooks for Claude Code) ----
# Baked into /opt (root-owned, world-readable) so it's NOT shadowed by the
# persisted home volume — its installer symlinks the commands/hooks/CLIs into
# ~/.claude and ~/.local/bin at runtime from the entrypoint, which is the only
# place that reliably writes into the volume regardless of its age. Placed after
# the agent-os build so bumping AUTOPILOT_REF doesn't invalidate that layer.
# Defaults to `multi-agent-support` (latest on each rebuild): unlike
# AGENT_OS_REF there are no source-anchored patches against this repo, so
# tracking the branch is safe.
# Override with: docker compose build --build-arg AUTOPILOT_REF=<sha|tag|branch>
ARG AUTOPILOT_REF=multi-agent-support
ENV AUTOPILOT_REPO=/opt/autopilot-multi
RUN git init "${AUTOPILOT_REPO}" \
    && cd "${AUTOPILOT_REPO}" \
    && git remote add origin https://github.com/thaqiif/autopilot-multi \
    && git fetch --depth 1 origin "${AUTOPILOT_REF}" \
    && git checkout --detach FETCH_HEAD

# ---- Non-root runtime user ----
# Pre-create the home subdirectories that docker-compose mounts as named
# volumes so the volumes inherit the agent user's ownership on first run.
# The agent user's UID/GID here are just defaults — the entrypoint remaps them
# at startup to PUID/PGID so files on bind-mounted host folders get the right
# owner. Build artifacts in /opt stay root-owned but world-readable.
RUN useradd --create-home --shell /bin/bash --uid 1001 agent \
    && mkdir -p \
        /home/agent/.agent-os \
        /home/agent/.config \
        /home/agent/.claude \
        /home/agent/.claude-profiles \
        /home/agent/.codex \
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
