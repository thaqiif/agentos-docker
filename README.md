# AgentOS Docker

Docker setup for [AgentOS](https://github.com/saadnvd1/agent-os) — a mobile-first web UI for managing AI coding sessions.

AgentOS lets you control AI agents like Claude Code, Codex, OpenCode, Gemini CLI, and others from a browser. This repo packages it into a Docker container for easy self-hosting.

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

Copy the example env file and edit it to configure the host workspace directory:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Host directory mounted as /workspaces inside the container.
# This is where your projects live.
WORKSPACE_DIR=/developer
```

Default is `/developer`. Change this to whatever path holds your code on the host.

## Volumes

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `agent_os_home` | `/home/agent/.agent-os` | AgentOS app data |
| `agent_os_config` | `/home/agent/.config` | Config files |
| `agent_os_claude` | `/home/agent/.claude` | Claude Code config (default profile) |
| `agent_os_claude_profiles` | `/home/agent/.claude-profiles` | Extra Claude Code profiles (`claude-a`, …) |
| `agent_os_codex` | `/home/agent/.codex` | Codex config |
| `agent_os_ssh` | `/home/agent/.ssh` | SSH keys |
| Host bind | `/workspaces` | Your projects (configurable via `WORKSPACE_DIR`) |

## Installed Agents

The container comes with these pre-installed:

- **Claude Code** — Anthropic's coding agent (`claude`)
- **Codex** — OpenAI's coding agent
- **OpenCode** — open-source coding tool
- **Gemini CLI** — Google's AI CLI

(AgentOS itself — the web UI — runs the whole thing.)

## Multiple Claude Code Logins

You can run several Claude Code identities side by side, each with its own
isolated authentication and config:

- `claude` — the default profile (`~/.claude`). Use this for your main login.
- `claude-a`, `claude-b`, `claude-c`, … — extra profiles, each authenticated
  independently. Run `claude-a` once and log in; its credentials are stored in
  `~/.claude-profiles/a` and never mix with the others.

Configure which profiles exist via the `CLAUDE_PROFILES` env var in
`docker-compose.yml` (space-separated names — they don't have to be single
letters):

```yaml
    environment:
      CLAUDE_PROFILES: "a b c"        # -> claude-a, claude-b, claude-c
      # CLAUDE_PROFILES: "work personal client1"
```

Under the hood each `claude-<name>` wrapper just sets `CLAUDE_CONFIG_DIR` to a
separate directory, so the official `claude` CLI does all the work. The profile
auth is persisted in the `agent_os_claude_profiles` volume across restarts.

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
