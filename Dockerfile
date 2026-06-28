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
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
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
        @google/gemini-cli \
    && npm cache clean --force

# ---- Build AgentOS from source ----
# We build into /opt (outside the persisted home volume) so that rebuilding
# the image always ships fresh build artifacts instead of being shadowed by an
# old named volume.
ENV AGENT_OS_REPO=/opt/agent-os
RUN git clone --depth 1 --branch "${AGENT_OS_REF}" \
        https://github.com/saadnvd1/agent-os "${AGENT_OS_REPO}" \
    && cd "${AGENT_OS_REPO}" \
    && npm install --legacy-peer-deps \
    && npm run build \
    && npm cache clean --force

# ---- Non-root runtime user ----
# Pre-create the home subdirectories that docker-compose mounts as named
# volumes so the volumes inherit the agent user's ownership on first run.
RUN useradd --create-home --shell /bin/bash --uid 1001 agent \
    && mkdir -p \
        /home/agent/.agent-os \
        /home/agent/.config \
        /home/agent/.claude \
        /home/agent/.claude-profiles \
        /home/agent/.codex \
        /home/agent/.ssh \
        /home/agent/.local/bin \
        /workspaces \
    && chmod 700 /home/agent/.ssh \
    && chown -R agent:agent /home/agent /opt/agent-os

ENV HOME=/home/agent \
    AGENT_OS_HOME=/home/agent/.agent-os \
    AGENT_OS_PORT=3011 \
    NODE_ENV=production \
    PATH=/home/agent/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin \
    # Extra Claude Code profiles to create, each with isolated auth/config.
    # Generates claude-a, claude-b, claude-c ... wrappers. Override in compose.
    CLAUDE_PROFILES="a b c"

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER agent
WORKDIR /opt/agent-os

EXPOSE 3011

ENTRYPOINT ["docker-entrypoint.sh"]
