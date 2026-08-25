# AgentOS in Docker
#
# Builds a vendored, patched fork of the AgentOS web UI (originally from
# https://github.com/saadnvd1/agent-os, pinned at commit 378069f and forked
# under agent-os/ in this repo with our downstream UI patches already applied)
# into a self-contained image and runs it in the foreground as a non-root user.

FROM node:22-bookworm-slim

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
RUN set -eux; \
    pkgs=""; \
    if [ "${INSTALL_CLAUDE_CODE}" = "true" ]; then pkgs="${pkgs} @anthropic-ai/claude-code"; fi; \
    if [ "${INSTALL_CODEX}" = "true" ]; then pkgs="${pkgs} @openai/codex"; fi; \
    if [ "${INSTALL_OPENCODE}" = "true" ]; then pkgs="${pkgs} opencode-ai"; fi; \
    if [ "${INSTALL_COMMAND_CODE}" = "true" ]; then pkgs="${pkgs} command-code"; fi; \
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
# old named volume. Source lives in agent-os/ in this repo: a vendored fork of
# upstream (pinned at commit 378069f) with all our downstream UI patches
# (extra harnesses, terminal/toolbar fixes, JetBrains Mono font, mobile safe
# areas, etc.) already applied directly to the source — no build-time codegen
# needed, no network fetch of the upstream repo.
ENV AGENT_OS_REPO=/opt/agent-os
COPY agent-os/ "${AGENT_OS_REPO}"/
RUN cd "${AGENT_OS_REPO}" \
    && npm install --legacy-peer-deps \
    && npm run build \
    && npm cache clean --force

# ---- autopilotagent (multi-agent TDD workflow: Claude/Codex/OpenCode/cmd) ----
# Baked into /opt (root-owned, world-readable) so it's NOT shadowed by the
# persisted home volume — the entrypoint symlinks commands/skills/hooks/CLIs
# into every agent home (~/.claude, ~/.codex, ~/.agents/skills, …) at runtime,
# which is the only place that reliably writes into the volume regardless of
# its age. Placed after the agent-os build so bumping AUTOPILOT_REF doesn't
# invalidate that layer. Defaults to `multi-agent-support` (latest on each
# rebuild): unlike the vendored agent-os/ source there are no patches against
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

# Extra Claude Code profiles the entrypoint generates claude-a, claude-b, ...
# wrappers for at runtime. The matching UI harnesses (claude-a/b/c) are baked
# into agent-os/'s vendored source already — adding a profile here past a/b/c
# gets you a working wrapper CLI but no matching entry in the session-provider
# dropdown; edit the vendored source directly (or re-run
# inject-claude-profiles.mjs from git history) if you need more UI harnesses.
ARG CLAUDE_PROFILES="a b c"

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
    CLAUDE_PROFILES=${CLAUDE_PROFILES}

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Entrypoint starts as root to remap the user, then drops to agent via gosu.
WORKDIR /opt/agent-os

EXPOSE 3011

ENTRYPOINT ["docker-entrypoint.sh"]
