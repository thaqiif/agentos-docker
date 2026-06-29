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

# ---- Re-create home scaffolding ----------------------------------------------
# $HOME is a persisted named volume, so on the very first start it's empty and
# shadows the directories the image created at build time. Re-make the standard
# dirs (and fix ~/.ssh perms, which OpenSSH requires to be 0700) so every tool
# has its home in place regardless of volume age.
mkdir -p \
    "${HOME}/.agent-os" \
    "${HOME}/.config" \
    "${HOME}/.claude" \
    "${HOME}/.codex" \
    "${HOME}/.ssh" \
    "${HOME}/.gitstate" \
    "${HOME}/.local/bin"
chmod 700 "${HOME}/.ssh"

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

# ---- Install autopilot-multi into every Claude config dir --------------------
# autopilot-multi is baked into /opt (unshadowed by the home volume). Its own
# install.sh only wires up the DEFAULT profile (~/.claude) plus the shared CLIs.
# Each extra Claude profile, though, runs with an isolated CLAUDE_CONFIG_DIR
# (~/.claude-profiles/<name>), so it would NOT see the slash commands/hooks. So
# we mirror the autopilot config into the default dir AND every profile dir, so
# /autopilot works on whichever Claude login a session uses. Idempotent
# (`ln -sfn`) and pointed at /opt, so a rebuild that bumps autopilot is picked up
# automatically; the chown below gives the new links agent ownership.
AUTOPILOT_REPO="${AUTOPILOT_REPO:-/opt/autopilot-multi}"
if [ -d "${AUTOPILOT_REPO}" ]; then
    # Shared terminal CLIs — one copy on PATH, used by all profiles.
    ln -sfn "${AUTOPILOT_REPO}/run.sh" "${BIN_DIR}/autopilot"
    ln -sfn "${AUTOPILOT_REPO}/cleanup.sh" "${BIN_DIR}/autopilot-cleanup"

    # Mirror the per-config-dir bits (commands, hooks, AGENTS.md, hooks.json)
    # into one Claude config dir. Mirrors autopilot's install.sh, kept minimal.
    install_autopilot_config() {
        cfg="$1"
        mkdir -p "${cfg}/commands" "${cfg}/hooks"
        # Clean slate: drop command symlinks left by a previous autopilot ref so
        # switching branches can't leave behind commands that no longer exist
        # upstream. Only links that resolve into AUTOPILOT_REPO are removed, so
        # any user-added commands in this dir are preserved.
        for link in "${cfg}/commands"/*; do
            [ -L "${link}" ] || continue
            case "$(readlink "${link}")" in
                "${AUTOPILOT_REPO}"/*) rm -f "${link}" ;;
            esac
        done
        # Slash commands — enumerated, so commands autopilot adds are picked up.
        for f in "${AUTOPILOT_REPO}"/commands/*.md; do
            if [ -e "${f}" ]; then
                ln -sfn "${f}" "${cfg}/commands/$(basename "${f}")"
            fi
        done
        ln -sfn "${AUTOPILOT_REPO}/AGENTS.md" "${cfg}/AGENTS.md"
        ln -sfn "${AUTOPILOT_REPO}/hooks/stop-hook.sh" \
            "${cfg}/hooks/autopilot-stop-hook.sh"
        ln -sfn "${AUTOPILOT_REPO}/hooks/git-commit" "${cfg}/hooks/git-commit"
        # Register the stop hook, pointed at THIS dir's copy. Don't clobber an
        # existing hooks.json — the user may have customised it.
        if [ ! -f "${cfg}/hooks.json" ]; then
            cat > "${cfg}/hooks.json" <<HOOKEOF
{
  "hooks": {
    "stop": [
      {
        "command": "${cfg}/hooks/autopilot-stop-hook.sh",
        "description": "Autopilot loop mechanism"
      }
    ]
  }
}
HOOKEOF
        fi
    }

    install_autopilot_config "${HOME}/.claude"
    for name in ${CLAUDE_PROFILES:-}; do
        install_autopilot_config "${PROFILE_ROOT}/${name}"
    done
fi

# Make sure the agent user owns its home (incl. mounted config/auth volumes) and
# the app's writable build cache after any UID/GID change. node_modules and the
# rest of /opt stay root-owned but world-readable, so no slow recursive chown.
chown -R agent:agent "${HOME}"
chown agent:agent "${AGENT_OS_REPO:-/opt/agent-os}"
mkdir -p "${AGENT_OS_REPO:-/opt/agent-os}/.next/cache"
chown -R agent:agent "${AGENT_OS_REPO:-/opt/agent-os}/.next/cache"

# ---- Persist git credentials & identity --------------------------------------
# GIT_CONFIG_GLOBAL points at ~/.gitstate/config (inside the persisted home
# volume), so any `git config --global ...` the user runs survives restarts.
# Enable the `store` helper, pointing the credentials file at the same dir so
# HTTPS logins (e.g. a GitHub token) are remembered too. We set the file path
# explicitly rather than relying on the default ~/.git-credentials. Run as the
# agent user, after the chown above so the dir is writable by it.
gosu agent git config --global credential.helper \
    "store --file=${HOME}/.gitstate/credentials"

# AgentOS' server.ts reads the listening port from $PORT. Upstream's CLI exposes
# it as AGENT_OS_PORT, so map it through here to keep that name working.
export PORT="${AGENT_OS_PORT:-3011}"

cd "${AGENT_OS_REPO:-/opt/agent-os}"

# Drop to the agent user and start the server in the foreground.
# `npm start` runs: NODE_ENV=production tsx server.ts  (binds 0.0.0.0:$PORT)
exec gosu agent npm start
