# AgentOS Docker

Docker setup for [AgentOS](https://github.com/saadnvd1/agent-os) — a mobile-first web UI for managing AI coding sessions.

AgentOS lets you control AI agents like Claude Code, Codex, OpenCode, and others from a browser. This repo packages it into a Docker container for easy self-hosting.

> **⚠️ Security Disclaimer**
>
> This setup exposes port 3011 to all network interfaces by default. Anyone on your network (or the internet, if the port is open) can access AgentOS and run AI agents on your machine. **Do not expose this to untrusted networks without proper protection.**
>
> Recommended mitigations:
> - Bind to localhost only: change `ports` in `docker-compose.yml` to `"127.0.0.1:3011:3011"`
> - Use a firewall to restrict access to the port
> - Use a VPN like [Tailscale](https://tailscale.com/) for remote access instead of exposing publicly
> - Put it behind a reverse proxy with authentication

## Quick Start

```bash
git clone https://github.com/thaqiif/agentos-docker.git
cd agentos-docker
docker compose up -d
```

Then open `http://localhost:3011` in your browser.

The first build clones and compiles AgentOS from source, so it takes a few
minutes. Follow the logs with `docker compose logs -f`.

## Configuration

Copy the example env file and edit it:

```bash
cp .env.example .env
```

`.env` holds all the settings you'll normally touch:

```env
# Host directory mounted as /workspaces inside the container — your projects.
WORKSPACE_DIR=/developer

# Run the container as your host user so files under /workspaces stay
# read/writable (see "File Permissions" below). Find yours with `id`.
PUID=1000
PGID=1000

# Extra Claude Code logins (see "Multiple Claude Code Logins" below).
CLAUDE_PROFILES=a b c
```

### File Permissions (PUID / PGID)

The container runs as a non-root user. For the bind-mounted `/workspaces` to be
read/writable — and for files the agents create to be owned by **you** on the
host (not `root`) — that user's UID/GID must match your host account.

Set `PUID`/`PGID` in `.env` to your host values. Find them by running `id` on
the host:

```bash
$ id
uid=1000(you) gid=1000(you) ...
```

The defaults are `1000:1000` (the first user on most Linux systems), so if
that's you, no change is needed. After changing them, run
`docker compose up -d` — no rebuild required.

> If you previously hit `Permission denied` in `/workspaces`, this is the fix:
> set `PUID`/`PGID` to match your host user and bring the stack back up.

## Volumes & Persistence

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `agent_os_home` | `/home/agent` | The agent user's entire home — **all** logins, configs and state |
| Host bind | `/workspaces` | Your projects (configurable via `WORKSPACE_DIR`) |

The whole home directory is persisted in a single `agent_os_home` volume. Each
agent CLI scatters its auth and state across different home paths — Claude Code
in `~/.claude` **and** the loose `~/.claude.json`, the extra profiles in
`~/.claude-profiles`, OpenCode in `~/.local/share/opencode`, Codex in
`~/.codex`, git in `~/.gitstate`, SSH keys in `~/.ssh`, and AgentOS itself in
`~/.agent-os` — including its SQLite database (`DB_PATH`), so your **projects and
session history** persist too. Mounting all of `$HOME` means every login and all
app state survive `docker compose down && up` (and image rebuilds), instead of
having to re-authenticate each tool or re-create your projects. Build artifacts
live in `/opt` (outside home), so nothing important is shadowed.

> Log in to each agent **once** and it stays logged in. To wipe all saved
> logins/state, remove the volume: `docker compose down -v`.

### Git credentials

`git`'s global config is relocated to `~/.gitstate/config` (via
`GIT_CONFIG_GLOBAL`) and the `store` credential helper writes to
`~/.gitstate/credentials` — both inside the persisted home volume. So your
`git config --global user.name/email` and any HTTPS credentials (e.g. a GitHub
token entered on first `git push`) are remembered across restarts. SSH keys you
add to `~/.ssh` persist too.

## Installed Agents

The container comes with these pre-installed:

- **Claude Code** — Anthropic's coding agent (`claude`, plus extra profiles)
- **Codex** — OpenAI's coding agent
- **OpenCode** — open-source coding tool

(AgentOS itself — the web UI — runs the whole thing.)

## Multiple Claude Code Logins

You can run several Claude Code identities side by side, each with its own
isolated authentication and config:

- `claude` — the default profile (`~/.claude`). Use this for your main login.
- `claude-a`, `claude-b`, `claude-c`, … — extra profiles, each authenticated
  independently. Run `claude-a` once and log in; its credentials are stored in
  `~/.claude-profiles/a` and never mix with the others.

Configure which profiles exist via `CLAUDE_PROFILES` in your `.env` file
(space-separated names — they don't have to be single letters):

```env
CLAUDE_PROFILES=a b c                 # -> claude-a, claude-b, claude-c
# CLAUDE_PROFILES=work personal client1
```

Each profile also shows up as its own **selectable harness in the AgentOS UI**
(e.g. "Claude (mimo)"), so you can start a session against a specific login from
the new-session dialog — with full status detection, resume, and fork support.
Profiles also appear in a project's **Default Agent** dropdown (New Project and
Project Settings), so "Start Fresh" launches new sessions with the profile you
picked as that project's default.

Because that harness list is compiled into the app, apply changes with a
rebuild:

```bash
docker compose up -d --build
```

Removing a name does **not** delete its saved login: the config is kept in the
`agent_os_claude_profiles` volume, so adding the name back later restores that
profile exactly as it was.

Under the hood each `claude-<name>` wrapper just sets `CLAUDE_CONFIG_DIR` to a
separate directory, so the official `claude` CLI does all the work. A build-time
codegen step ([`inject-claude-profiles.mjs`](inject-claude-profiles.mjs))
registers each profile as an AgentOS provider.

## Mobile

On a phone (viewport < 768px) the terminal shows an always-visible **special-keys
toolbar** — Esc, Tab, Ctrl-C, Ctrl-D, arrow keys, plus paste/mic/copy — for keys
a touch keyboard lacks. It appears automatically; there's nothing to enable.

This image also carries a downstream fix for upstream's mobile layout: the
`MobileView` root uses a fixed `h-screen` (`100vh`), which on mobile pushes the
terminal's bottom (your prompt **and** the toolbar) *behind* the on-screen
keyboard, so you can't see what you type. The app already tracks the keyboard via
`useViewportHeight()` → `--app-height`, so a build-time codegen step
([`inject-mobile-viewport-fix.mjs`](inject-mobile-viewport-fix.mjs)) switches the
root to the keyboard-aware `h-app` height. The prompt and toolbar then stay above
the keyboard.

## Docker Socket (Optional)

Uncomment the `/var/run/docker.sock` line under `volumes:` in `docker-compose.yml` if you want AgentOS sessions to control the host Docker daemon.

> **Warning:** This gives the agent full control over Docker on your server.

## Stopping

```bash
docker compose down
```

To also remove volumes (wipes all config/state):

```bash
docker compose down -v
```

## Links

- [AgentOS (upstream)](https://github.com/saadnvd1/agent-os)
- [AgentOS Docs](https://runagentos.com/docs)
