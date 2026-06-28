#!/usr/bin/env bash
set -euo pipefail

# AgentOS' server.ts reads the listening port from $PORT. Upstream's CLI exposes
# it as AGENT_OS_PORT, so map it through here to keep that name working.
export PORT="${AGENT_OS_PORT:-3011}"

# ---- Generate isolated Claude Code profiles ----------------------------------
# `claude`            -> default ~/.claude   (your official / primary auth)
# `claude-a`, ...     -> ~/.claude-profiles/<name>, each with its own auth.
# Each wrapper just points Claude Code at a separate CLAUDE_CONFIG_DIR.
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

cd "${AGENT_OS_REPO:-/opt/agent-os}"

# `npm start` runs: NODE_ENV=production tsx server.ts  (binds 0.0.0.0:$PORT)
exec npm start
