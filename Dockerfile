# AgentOS in Docker
#
# Builds the upstream AgentOS web UI (https://github.com/saadnvd1/agent-os)
# into a self-contained image and runs it in the foreground as a non-root user.

FROM node:20-bookworm-slim

# Which ref of the upstream repo to build. Override with:
#   docker compose build --build-arg AGENT_OS_REF=v0.2.1
ARG AGENT_OS_REF=main

# ---- System dependencies AgentOS needs at runtime ----
# tmux: drives the terminal sessions  |  ripgrep: code search
# git/openssh: cloning & git integration  |  procps: process management for tmux
# gosu: drop from root to the agent user after remapping its UID/GID at startup
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        gosu \
        less \
        openssh-client \
        procps \
        ripgrep \
        tmux \
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

# Clone + install deps. Kept separate so it stays cached when only the profile
# list (CLAUDE_PROFILES) changes.
RUN git clone --depth 1 --branch "${AGENT_OS_REF}" \
        https://github.com/saadnvd1/agent-os "${AGENT_OS_REPO}" \
    && cd "${AGENT_OS_REPO}" \
    && npm install --legacy-peer-deps

# Register the configured Claude profiles as selectable harnesses in the UI and
# bake the terminal font size into the bundle, then build. Declared here (after
# install) so changing these only re-runs codegen + build, not the slow clone +
# npm install above. The xterm.js font size is compiled into the client bundle,
# so it can't be changed at runtime — patch it at build time instead.
ARG CLAUDE_PROFILES="a b c"
ARG TERMINAL_FONT_SIZE=16
ARG TERMINAL_FONT_SIZE_MOBILE=13
COPY inject-claude-profiles.mjs /tmp/inject-claude-profiles.mjs
COPY inject-terminal-font.mjs /tmp/inject-terminal-font.mjs
RUN cd "${AGENT_OS_REPO}" \
    && CLAUDE_PROFILES="${CLAUDE_PROFILES}" node /tmp/inject-claude-profiles.mjs "${AGENT_OS_REPO}" \
    && TERMINAL_FONT_SIZE="${TERMINAL_FONT_SIZE}" \
       TERMINAL_FONT_SIZE_MOBILE="${TERMINAL_FONT_SIZE_MOBILE}" \
       node /tmp/inject-terminal-font.mjs "${AGENT_OS_REPO}" \
    && npm run build \
    && npm cache clean --force

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
