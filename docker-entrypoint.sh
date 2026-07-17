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
    "${HOME}/.agents/skills" \
    "${HOME}/.config/opencode" \
    "${HOME}/.claude" \
    "${HOME}/.codex" \
    "${HOME}/.commandcode" \
    "${HOME}/.zero" \
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

# ---- Install autopilotagent (multi-agent TDD workflow) -----------------------
# Repo lives in /opt (not shadowed by home volume). Upstream install.sh only
# wires the DEFAULT ~/.claude + shared agent homes; we also mirror into every
# Claude profile dir (~/.claude-profiles/<name>) so /autopilotagent works on
# any login. Idempotent (`ln -sfn`); rebuild that bumps AUTOPILOT_REF is picked
# up on next boot. chown below gives new links agent ownership.
AUTOPILOT_REPO="${AUTOPILOT_REPO:-/opt/autopilot-multi}"
if [ -d "${AUTOPILOT_REPO}" ]; then
    # Shared terminal CLIs — one copy on PATH for every agent.
    ln -sfn "${AUTOPILOT_REPO}/run.sh" "${BIN_DIR}/autopilotagent"
    ln -sfn "${AUTOPILOT_REPO}/cleanup.sh" "${BIN_DIR}/autopilotagent-cleanup"
    # Drop pre-rename bin names so stale volumes don't keep the old CLI around.
    rm -f "${BIN_DIR}/autopilot" "${BIN_DIR}/autopilot-cleanup"

    # link_agent_file SRC DST — symlink, replace prior autopilotagent link only.
    link_agent_file() {
        src="$1"
        dst="$2"
        [ -e "${src}" ] || return 0
        mkdir -p "$(dirname "${dst}")"
        ln -sfn "${src}" "${dst}"
    }

    # Drop stale symlinks under DIR that still point into AUTOPILOT_REPO.
    clean_repo_links() {
        dir="$1"
        [ -d "${dir}" ] || return 0
        for link in "${dir}"/*; do
            [ -L "${link}" ] || continue
            case "$(readlink "${link}")" in
                "${AUTOPILOT_REPO}"/*) rm -f "${link}" ;;
            esac
        done
    }

    # Claude config dir: slash commands, skills, hooks, AGENTS.md.
    install_claude_config() {
        cfg="$1"
        mkdir -p "${cfg}/commands" "${cfg}/hooks" "${cfg}/skills"
        clean_repo_links "${cfg}/commands"
        clean_repo_links "${cfg}/skills"
        for f in "${AUTOPILOT_REPO}"/commands/*.md; do
            [ -e "${f}" ] || continue
            ln -sfn "${f}" "${cfg}/commands/$(basename "${f}")"
        done
        for skill_dir in "${AUTOPILOT_REPO}"/skills/*; do
            [ -d "${skill_dir}" ] || continue
            ln -sfn "${skill_dir}" "${cfg}/skills/$(basename "${skill_dir}")"
        done
        ln -sfn "${AUTOPILOT_REPO}/AGENTS.md" "${cfg}/AGENTS.md"
        # New hook name; drop the pre-rename stop-hook symlink if present.
        rm -f "${cfg}/hooks/autopilot-stop-hook.sh"
        ln -sfn "${AUTOPILOT_REPO}/hooks/stop-hook.sh" \
            "${cfg}/hooks/autopilotagent-stop-hook.sh"
        ln -sfn "${AUTOPILOT_REPO}/hooks/git-commit" "${cfg}/hooks/git-commit"
        # Register stop hook for THIS dir. Don't clobber a customised hooks.json.
        if [ ! -f "${cfg}/hooks.json" ]; then
            cat > "${cfg}/hooks.json" <<HOOKEOF
{
  "hooks": {
    "stop": [
      {
        "command": "${cfg}/hooks/autopilotagent-stop-hook.sh",
        "description": "Autopilotagent loop mechanism"
      }
    ]
  }
}
HOOKEOF
        fi
    }

    # Non-Claude agent home: AGENTS.md + command specs + skills.
    # Skills dest differs per agent (Codex uses shared ~/.agents/skills).
    install_agent_home() {
        agent_home="$1"
        skills_dest="$2"
        mkdir -p "${agent_home}/autopilotagent" "${skills_dest}"
        link_agent_file "${AUTOPILOT_REPO}/AGENTS.md" "${agent_home}/AGENTS.md"
        link_agent_file "${AUTOPILOT_REPO}/commands" \
            "${agent_home}/autopilotagent/commands"
        clean_repo_links "${skills_dest}"
        for skill_dir in "${AUTOPILOT_REPO}"/skills/*; do
            [ -d "${skill_dir}" ] || continue
            ln -sfn "${skill_dir}" "${skills_dest}/$(basename "${skill_dir}")"
        done
    }

    # Claude — default + every isolated profile.
    install_claude_config "${HOME}/.claude"
    for name in ${CLAUDE_PROFILES:-}; do
        install_claude_config "${PROFILE_ROOT}/${name}"
    done

    # Codex / OpenCode / Command Code — skills + shared instructions.
    install_agent_home "${HOME}/.codex" "${HOME}/.agents/skills"
    install_agent_home "${HOME}/.config/opencode" "${HOME}/.config/opencode/skills"
    install_agent_home "${HOME}/.commandcode" "${HOME}/.commandcode/skills"
fi

# ---- Docker socket access (Docker-out-of-Docker) -------------------------------
# If the host docker socket is mounted, detect its group GID and add the agent
# user to that group so `docker` commands work from inside the container.
DOCKER_SOCK="${DOCKER_SOCK:-/var/run/docker.sock}"
if [ -S "${DOCKER_SOCK}" ]; then
    docker_gid="$(stat -c '%g' "${DOCKER_SOCK}" 2>/dev/null || true)"
    if [ -n "${docker_gid}" ] && [ "${docker_gid}" != "0" ]; then
        groupadd --force --gid "${docker_gid}" docker-sock-group 2>/dev/null || true
        usermod --append --groups docker-sock-group agent 2>/dev/null || true
    fi
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

# Start as the agent user with all supplemental groups initialized (critical for
# Docker socket access: the docker group membership set above is only effective
# if initgroups() is called). setpriv is part of util-linux (Essential: yes on
# Debian), so it's always available even in slim.
cd "${AGENT_OS_REPO:-/opt/agent-os}"
exec setpriv --reuid=agent --regid=agent --init-groups -- npm start
