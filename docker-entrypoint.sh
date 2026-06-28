#!/usr/bin/env bash
set -euo pipefail

# This script starts as root, aligns the `agent` user with the host's UID/GID so
# bind-mounted folders (e.g. /workspaces) are read/writable, then drops to that
# user to run the server. Set PUID/PGID to match `id` on the host.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Remap the agent group/user to the requested IDs (-o allows reusing an ID that
# already exists in the base image, e.g. 1000).
if [ "$(id -g agent)" != "${PGID}" ]; then
    groupmod -o -g "${PGID}" agent
fi
if [ "$(id -u agent)" != "${PUID}" ]; then
    usermod -o -u "${PUID}" agent
fi

# ---- Generate isolated Claude Code profiles ----------------------------------
# `claude`        -> default ~/.claude   (your official / primary auth)
# `claude-a`, ... -> ~/.claude-profiles/<name>, each with its own auth.
BIN_DIR="${HOME}/.local/bin"
PROFILE_ROOT="${HOME}/.claude-profiles"
mkdir -p "${BIN_DIR}" "${PROFILE_ROOT}"

for name in ${CLAUDE_PROFILES:-}; do
    cfg="${PROFILE_ROOT}/${name}"
    wrapper="${BIN_DIR}/claude-${name}"
    mkdir -p "${cfg}"
    cat > "${wrapper}" <<EOF
#!/usr/bin/env bash
# Isolated Claude Code profile "${name}". Run \`claude-${name}\` and authenticate
# once; its credentials live in ${cfg} and won't touch other profiles.
export CLAUDE_CONFIG_DIR="${cfg}"
exec claude "\$@"
EOF
    chmod +x "${wrapper}"
done

# Make sure the agent user owns its home (incl. mounted config/auth volumes) and
# the app's writable build cache after any UID/GID change. node_modules and the
# rest of /opt stay root-owned but world-readable, so no slow recursive chown.
chown -R agent:agent "${HOME}"
chown agent:agent "${AGENT_OS_REPO:-/opt/agent-os}"
mkdir -p "${AGENT_OS_REPO:-/opt/agent-os}/.next/cache"
chown -R agent:agent "${AGENT_OS_REPO:-/opt/agent-os}/.next/cache"

# AgentOS' server.ts reads the listening port from $PORT. Upstream's CLI exposes
# it as AGENT_OS_PORT, so map it through here to keep that name working.
export PORT="${AGENT_OS_PORT:-3011}"

cd "${AGENT_OS_REPO:-/opt/agent-os}"

# Drop to the agent user and start the server in the foreground.
# `npm start` runs: NODE_ENV=production tsx server.ts  (binds 0.0.0.0:$PORT)
exec gosu agent npm start
