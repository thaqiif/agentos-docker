# AgentOS Docker

> Self-host [**AgentOS**](https://github.com/saadnvd1/agent-os) — the mobile-first
> web UI for driving AI coding agents — as a single Docker container, with a few
> quality-of-life touches for self-hosters and phone users.

Run Claude Code, Codex, OpenCode, and Command Code from your browser (including
your phone), fully self-hosted, with `docker compose up -d`.

## What is this?

[AgentOS](https://github.com/saadnvd1/agent-os) (by
[@saadnvd1](https://github.com/saadnvd1)) is a lovely open-source, mobile-first
web app that lets you start and manage AI coding-agent terminals from any browser.

**This repo vendors a patched fork of AgentOS** (under [`agent-os/`](agent-os/),
forked from commit
[`378069f`](https://github.com/saadnvd1/agent-os/commit/378069fed63708179ae4dd9ddad1a2ce64f37d5d))
and packages it as a self-contained, self-hostable Docker image, with a handful
of small conveniences layered in (persistent logins, multiple Claude accounts, a
friendlier mobile keyboard, an autonomous TDD workflow, a couple of bundled
CLIs).

It exists for one reason: to make AgentOS effortless to **self-host and keep
running** — one command to start, your logins and history survive restarts, and
your phone behaves. The Docker/self-hosting layer is maintained here
standalone, with no build-time dependency on the upstream repo.

## Credit & relationship to upstream

All the real work — the app, the design, the UX — is
[@saadnvd1](https://github.com/saadnvd1)'s. If you find this useful, please go
[⭐ star **agent-os**](https://github.com/saadnvd1/agent-os) first. 💛

The `agent-os/` directory here is a fork of upstream at commit `378069f`, with
our downstream UI patches applied directly to the source (see
[Downstream patches](#downstream-patches--enhancements) below). It's maintained
independently — it does not track upstream's `main` branch and isn't kept in
sync automatically. For questions about AgentOS the app itself, see the
official [docs](https://runagentos.com/docs).

## What this image adds over upstream

| Enhancement | What you get | More |
|---|---|---|
| 🔐 **Persistent logins & state** | Authenticate each agent once — logins, projects, and terminal state survive restarts and rebuilds | [Volumes](#volumes--persistence) |
| 👥 **Multiple Claude accounts** | Run `claude`, `claude-a`, `claude-b`… side by side, each its own login, selectable in the UI | [Logins](#multiple-claude-code-logins) |
| 📱 **Friendlier mobile keyboard** | Keyboard-overlap fix, plus toolbar keys for newline, ⇧Tab, and ⌃/⌥ modifiers | [Mobile](#mobile) |
| 🤖 **Autopilotagent TDD workflow** | `autopilotagent` skills/commands/hooks for Claude, Codex, OpenCode, Command Code | [Autopilotagent](#autopilotagent-tdd-workflow) |
| 🔤 **JetBrains Mono code font** | Terminal & UI code blocks render in self-hosted JetBrains Mono | [Font](#terminal--code-font) |
| 🧰 **Bundled CLIs** | `gh`, `bun`, `git`, `ripgrep`, `tmux`, `jq` preinstalled in every terminal | [Agents](#installed-agents) |
| 🌐 **Headless browser** | Chromium + system libs baked in so agents can render & screenshot the frontends they build | [Browser](#browser-verification) |
| 👤 **Host-matched file ownership** | `PUID`/`PGID` so files in your mounted workspace stay owned by *you* | [Permissions](#file-permissions-puid--pgid) |
| 🩹 **Quality-of-life fixes** | Inline terminal rename works again (upstream Radix focus-restore bug) | [Font & fixes](#terminal--code-font) |
| 📦 **Standalone build** | Patched source vendored in-repo — no network fetch of upstream at build time | [Vendored source](#vendored-source) |

> **⚠️ Security Disclaimer**
>
> This setup exposes port `HOST_PORT` (default 3011) to all network interfaces by default. Anyone on your network (or the internet, if the port is open) can access AgentOS and run AI agents on your machine. **Do not expose this to untrusted networks without proper protection.**
>
> Recommended mitigations:
> - Bind to localhost only: change `ports` in `docker-compose.yml` to `"127.0.0.1:${HOST_PORT:-3011}:3011"`
> - Use a firewall to restrict access to the port
> - Use a VPN like [Tailscale](https://tailscale.com/) for remote access instead of exposing publicly
> - Put it behind a reverse proxy with authentication

## Quick Start

```bash
git clone https://github.com/thaqiif/agentos-docker.git
cd agentos-docker
docker compose up -d
```

Then open `http://localhost:3011` in your browser (or your `HOST_PORT` from
`.env`, if you've set one — e.g. because 3011 is already taken on your host).

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

# Terminal font size in px (desktop / mobile). See "Terminal Font Size" below.
TERMINAL_FONT_SIZE=16
TERMINAL_FONT_SIZE_MOBILE=13
```

> No `.env` is required — sensible defaults are baked in. Create one only to
> change something. You can also drop agent API keys (e.g. `ANTHROPIC_API_KEY`)
> in here; everything in `.env` is passed through to the container.

### Settings reference

Runtime settings (in `.env`, applied with `docker compose up -d` — no rebuild):

| Variable | Default | What it does |
|---|---|---|
| `WORKSPACE_DIR` | `/developer` | Host directory mounted as `/workspaces` (your projects) |
| `HOST_PORT` | `3011` | Host port AgentOS is reachable on (container always listens on 3011 internally) |
| `PUID` / `PGID` | `1000` / `1000` | Host user/group IDs to run as, so workspace files stay yours |
| `CLAUDE_PROFILES` | `a b c` | Extra `claude-<name>` login wrappers the entrypoint generates (rebuild to change — it's also a build arg) |
| `ENABLE_DOCKER` | `false` | Install Docker CLI and allow access to host Docker socket (rebuild to change) |

Build args (passed at **build** time, e.g. `docker compose build --build-arg NAME=value`):

| Build arg | Default | What it does |
|---|---|---|
| `AUTOPILOT_REF` | `multi-agent-support` | Which [autopilotagent](#autopilotagent-tdd-workflow) ref to bundle |
| `CLAUDE_PROFILES` | `a b c` | `claude-<name>` login wrapper names (also read from `.env`) — does **not** change the UI's harness list, see below |
| `ENABLE_DOCKER` | `false` | Whether to install Docker CLI (`true`/`false`) |

The terminal font size (16px desktop / 13px mobile), JetBrains Mono webfont,
and the UI's `claude-a`/`claude-b`/`claude-c` harness list are baked directly
into the vendored source in [`agent-os/`](agent-os/) rather than driven by
build args — see [Vendored source](#vendored-source) for how to change them.

**Component toggles** — every optional piece is gated by an `INSTALL_*` build arg
that **defaults to `true`**, so out of the box you get everything with no config.
Set any to `false` in `.env` and rebuild to trim it from the image:

| Build arg | Skips | Notes |
|---|---|---|
| `INSTALL_CLAUDE_CODE` | Claude Code CLI | Also disables the `claude`/`claude-*` harnesses — leave on unless you only use the other agents |
| `INSTALL_CODEX` | OpenAI Codex CLI | |
| `INSTALL_OPENCODE` | OpenCode CLI | |
| `INSTALL_COMMAND_CODE` | Command Code CLI | |
| `INSTALL_BROWSER` | Headless Chromium + libs | Biggest saving (~few hundred MB); see [Browser](#browser-verification) |
| `INSTALL_GH` | GitHub CLI (`gh`) | No runtime dependency; interactive use only |
| `INSTALL_BUN` | Bun JS runtime (`bun`) | Official installer; binary at `/usr/local/bin` |
| `INSTALL_AUTOPILOT` | autopilotagent workflow | Entrypoint skips it gracefully; no `/autopilotagent` |

> Anything **compiled into the bundle** (fonts, the profile harness list) needs a
> rebuild — `docker compose up -d --build` — to take effect. Plain runtime
> settings (`WORKSPACE_DIR`, `PUID`/`PGID`) only need `docker compose up -d`.

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
terminal state** persist too. Mounting all of `$HOME` means every login and all
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
- **Command Code** — coding agent that learns your coding taste
  ([commandcode.ai](https://commandcode.ai))

Plus a few supporting CLI tools on `PATH` inside every terminal:

- **GitHub CLI (`gh`)** — installed from GitHub's official apt repo for PRs,
  issues, and authenticated git over HTTPS. Run `gh auth login` once; the token
  lands in `~/.config`, which is in the persisted home volume, so it survives
  restarts.
- **Bun (`bun`)** — JS runtime / package manager via the [official
  installer](https://bun.com/docs/installation). Binary lands in
  `/usr/local/bin` so every terminal sees it. Gated by `INSTALL_BUN` (default
  `true`); set `false` and rebuild to skip.
- **git**, **ripgrep (`rg`)**, **tmux** — version control, code search, and the
  terminal multiplexer that drives AgentOS terminals.

(AgentOS itself — the web UI — runs the whole thing.)

Each agent CLI is **individually gated** so you don't ship (or wait on) tools you
never use. All default to installed; flip any off in `.env` and rebuild:

```env
INSTALL_CLAUDE_CODE=true
INSTALL_CODEX=false        # skip OpenAI Codex
INSTALL_OPENCODE=true
INSTALL_COMMAND_CODE=false # skip Command Code
INSTALL_BUN=false          # skip Bun runtime
```

> Leave `INSTALL_CLAUDE_CODE` on unless you only drive the other agents — turning
> it off removes the `claude` binary, so the `claude`/`claude-*` harnesses and
> profile wrappers stop working.

## Browser verification

Agents that build web frontends often want to *see* their work — render the page
and take a screenshot to check layout and styling, not just lint the code. A
plain Chromium binary can't do that here: it needs a stack of system libraries
(`libglib`, `libnss3`, `libatk`, …) that only root can `apt-get install`, and
agent processes run as the non-root `agent` user with no `sudo`. Installing them
at runtime is impossible.

So the image ships a working headless Chromium, installed **at build time** (as
root) via Playwright — both the browser and all its OS dependencies. It lives in
a shared, world-readable path (`/opt/ms-playwright`, via
`PLAYWRIGHT_BROWSERS_PATH`), so any agent can launch it without privileges.
`playwright` is also on the global `npm` path.

Agents can use it straight away — for example, a quick screenshot script:

```js
// screenshot.mjs — run with: node screenshot.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();          // headless by default
const page = await browser.newPage();
await page.goto('http://localhost:3000');         // the app under test
await page.screenshot({ path: 'shot.png', fullPage: true });
await browser.close();
```

or the CLI directly:

```bash
npx playwright screenshot http://localhost:3000 shot.png
```

Because the browser is on the shared path, `npm install playwright` inside a
project reuses this Chromium instead of re-downloading it. Only Chromium is
baked in; add Firefox/WebKit yourself with `npx playwright install <browser>` if
a project needs them (that download doesn't need root). The Playwright version
is pinned via the `PLAYWRIGHT_VERSION` build arg — override it with
`docker compose build --build-arg PLAYWRIGHT_VERSION=<x.y.z>`.

Bundling Chromium and its libraries adds a few hundred MB to the image. That's
the cost of visual verification — so it's **gated**. It's on by default; skip it
entirely by setting `INSTALL_BROWSER=false` in `.env` and rebuilding.

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
(e.g. "Claude (mimo)"), so you can start a terminal against a specific login from
the new-terminal dialog — with resume and fork support.
Profiles also appear in a project's **Default Agent** dropdown (New Project and
Project Settings), so "Start Fresh" launches new terminals with the profile you
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
separate directory, so the official `claude` CLI does all the work. Registering
each profile as an AgentOS provider (`inject-claude-profiles.mjs`, applied
directly to the vendored source) is what makes it selectable in the UI.

(See [Vendored source](#vendored-source) for where these patches live and how
to change them.)

## Terminal & Code Font

**JetBrains Mono.** The in-browser terminal and the UI's code blocks render in
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono). Upstream's xterm
config already names it first, but the font isn't actually shipped — so without
this it falls back to a system monospace. The rest of the UI keeps its Geist sans
typeface. The font is **self-hosted** — the `.woff2` webfonts are vendored under
`agent-os/public/fonts` and served from the app, so there's no runtime CDN
dependency.

**Configurable size.** The xterm.js font size is `16px` desktop / `13px`
mobile (upstream hardcodes `14` / `11`). Both the font swap and the size are
**compiled into the vendored source and client bundle** — to change them, edit
`agent-os/app/globals.css` (font) or the xterm config directly, then rebuild:

```bash
docker compose up -d --build
```

The UI (sans) font is also swapped from upstream's Geist to **Inter**, still
loaded via `next/font/google` (self-hosted at build, no runtime CDN), reusing
the existing `--font-geist-sans` variable so nothing else changes. The
terminal/mono font is untouched.

### Bug fixes

We also patch a couple of upstream rough edges (applied directly to the
vendored source, before we forked):

- **Inline terminal rename.** Renaming a terminal from its menu used to snap the
  text field straight back to read-only before you could type. The "Rename" item
  lives in a Radix menu whose default close behaviour restores focus to the
  trigger, which blurred the freshly-opened input.
  The focus-restoration fix keeps the field editable on both desktop and mobile.

## Mobile

On a phone (viewport < 768px) the terminal shows an always-visible **special-keys
toolbar** — Esc, Tab, Ctrl-C, Ctrl-D, arrow keys, plus paste/mic/copy — for keys
a touch keyboard lacks. It appears automatically; there's nothing to enable.

This image adds a few more keys to that toolbar
(`inject-terminal-toolbar-keys.mjs`):

- **⇧Tab** — sends the ANSI back-tab sequence (`\x1b[Z`), which is what Claude
  Code uses to cycle its modes (plan / auto-accept). There's no other way to send
  it from a touch keyboard.
- **↵ NL** — inserts a **newline** in the prompt without submitting. It sends
  `Alt+Enter` (`\x1b\r`) directly on tap, so unlike the `⌥` toggle below it works
  on every soft keyboard (no `keydown` needed). This is the reliable way to write
  multi-line messages on a phone.
- **⌃ (Ctrl)** — a modifier toggle (like the existing ⇧ button): tap it, then the
  **next** key becomes a control character (e.g. ⌃ then `r` → Ctrl-R). It's
  captured at the page level, so it works with your device keyboard on desktop.
  Some mobile soft keyboards don't emit a usable `keydown`, so the dedicated
  ^C / ^D buttons remain as a reliable fallback.
- **⌥ (Alt/Option)** — a modifier toggle that sends the **next** key ESC-prefixed
  (Meta). The main use on mobile is **⌥ then Return → newline**: Claude Code reads
  `Alt+Enter` (`\x1b\r`) as "insert a newline" instead of submitting the prompt,
  so you can write multi-line messages. Also gives you `Alt+b` / `Alt+f` for
  word-by-word navigation. Captured at the page level like ⌃.

This image also carries a downstream fix for upstream's mobile layout: the
`MobileView` root uses a fixed `h-screen` (`100vh`), which on mobile pushes the
terminal's bottom (your prompt **and** the toolbar) *behind* the on-screen
keyboard, so you can't see what you type. The app already tracks the keyboard via
`useViewportHeight()` → `--app-height`, so `inject-mobile-viewport-fix.mjs` switches the
root to the keyboard-aware `h-app` height. The prompt and toolbar then stay above
the keyboard.

The toolbar buttons were also sized purely by their label, so narrow keys (arrows,
`^C`) looked skinnier than wide ones (`Esc`, `⇧Tab`). `inject-toolbar-uniform-buttons.mjs`
gives every button a `min-w-[3.25rem]` floor and centers its content, so they all
render the same width. It also increases their vertical padding for a more
comfortable mobile touch target.

Key-sending buttons support **hold to repeat** (`inject-toolbar-key-repeat.mjs`):
holding a stationary pointer for 300 ms sends the first key, then repeats every
50 ms until release. Normal taps, keyboard activation, and assistive-technology
clicks still send exactly one key. Moving 10 px before repeat begins cancels the
hold without sending anything, so swiping the horizontally scrollable toolbar
does not accidentally type into the terminal.

The `^D` (Ctrl-D / EOF) key is also dropped from the toolbar
(`inject-remove-ctrl-d.mjs`) — an easy mis-tap
that logs you out of the shell.

It also carries a safe-area fix for installing AgentOS as a home-screen **web app
(PWA)**: launched standalone, the page gets the full screen (the layout sets
`viewportFit: "cover"`), so the mobile top bar — the `bg-muted` row with the
hamburger and tab navigation — would render *under* the device status bar / notch
and overlap it. `inject-safe-area-top-fix.mjs` adds
`env(safe-area-inset-top)` to that bar's top padding, so it sits below the status
bar. On devices/browsers with no inset, `env()` resolves to 0 and nothing changes.

The mobile side drawer (`SwipeSidebar`) had the same problem at the top: it's
`fixed top-0 bottom-0` and already pads the *bottom* inset, but its header (the
terminal list's add-project / add buttons) rendered under the status bar in a PWA.
`inject-mobile-drawer-safearea.mjs` adds a matching `env(safe-area-inset-top)` spacer above the drawer content so the
buttons clear the status bar.

Related: upstream sets the PWA `theme_color` to blue (`#3B82F6`) in both the web
manifest and `viewport.themeColor`. On an **installed** app — most visibly the
desktop app window — the browser tints the title bar / window chrome with that
colour, so you get a blue title bar above AgentOS's dark UI. AgentOS defaults to
the dark theme (`--background: #0a0a0a`), so
`inject-pwa-theme-color.mjs` rewrites the
manifest `theme_color`/`background_color` and `viewport.themeColor` to that
background, so the installed window chrome and splash match the app.

A note on the home-screen icon: a *real* PWA install (Android WebAPK / iOS
standalone), which uses the manifest icons, requires a **secure HTTPS origin**
(only `localhost` is exempt) served at a **domain root** (the manifest uses
absolute `/icons/...` paths — a subpath deployment 404s them). Over plain HTTP
the browser adds a mere *shortcut* and may show a generated letter tile. As
cheap insurance for that shortcut case,
`inject-raster-favicon.mjs` drops a PNG
`app/icon.png` so Next emits a raster `<link rel="icon">` alongside the SVG one,
giving launchers that won't rasterise an SVG favicon a real image to fall back
to. For a proper install, serve AgentOS over HTTPS (reverse proxy, Cloudflare
Tunnel, or Tailscale Serve).

## Autopilotagent (TDD workflow)

[autopilot-multi](https://github.com/thaqiif/autopilot-multi) — autonomous
test-driven development skills, commands, hooks, and CLIs — is baked into the
image and wired up automatically for **every** supported agent (Claude Code,
Codex, OpenCode, Command Code). You get:

- Claude: `/prd`, `/tasks`, `/autopilotagent`, `/analyze`, … slash commands + skills + stop hook
- Codex / OpenCode / Command Code: skills under each agent's skill path + shared `AGENTS.md` / command specs
- Terminal: `autopilotagent` and `autopilotagent-cleanup` on `PATH`

How it's installed: the repo is cloned into `/opt/autopilot-multi` at build time
(so it isn't shadowed by the home volume), and the entrypoint symlinks
commands/skills/hooks/CLIs into the persisted home volume on every boot. No
setup; survives restarts and rebuilds. (`jq`, its one dependency, ships in the
image.)

Claude installs into **every** login — default `~/.claude` plus each isolated
profile (`~/.claude-profiles/<name>`). Non-Claude installs:

| Agent | Skills | Specs |
|---|---|---|
| Codex | `~/.agents/skills/*` | `~/.codex/AGENTS.md`, `~/.codex/autopilotagent/commands` |
| OpenCode | `~/.config/opencode/skills/*` | `~/.config/opencode/AGENTS.md`, `…/autopilotagent/commands` |
| Command Code | `~/.commandcode/skills/*` | `~/.commandcode/AGENTS.md`, `…/autopilotagent/commands` |

Tracks `multi-agent-support` by default — bump just needs a rebuild (no
source-anchored patches against it). Pin if you want:

```bash
docker compose build --build-arg AUTOPILOT_REF=<sha|tag|branch>
```

Run `/autopilotagent init` (or the matching skill) in a project to configure it.
Terminal multi-agent runs: `autopilotagent tasks.json --agent codex`.

## Vendored Source

[`agent-os/`](agent-os/) is a fork of upstream AgentOS, taken from commit
[`378069f`](https://github.com/saadnvd1/agent-os/commit/378069fed63708179ae4dd9ddad1a2ce64f37d5d)
and committed here as a flat snapshot (no upstream git history), with all of
this repo's downstream patches applied directly to the source. The Dockerfile
just `COPY`s it in and builds — no network fetch of the upstream repo, no
build-time codegen, fully self-contained.

This is a **one-time fork**, not a tracked mirror: it does not sync against
upstream's `main` automatically, and there's currently no plan to rebase it
forward. If you want to pick up newer upstream changes, you'd re-fork
manually — diff `agent-os/` against a fresh checkout of upstream `main` (or a
newer commit) and re-apply the changes you want to keep.

To change something that's baked into the vendored source (the Claude profile
harness list, terminal font size, JetBrains Mono font, or any of the other UI
patches described above), edit the relevant file under `agent-os/` directly,
then rebuild:

```bash
docker compose up -d --build
```

The original patch scripts that produced this source (for reference, e.g. if
you want to regenerate a similar patch against a newer fork) are preserved in
this repo's git history — see the commit that introduced `agent-os/`.

## Docker Socket (Optional)

Let agents run `docker`, `docker compose`, and `docker buildx` for their own
testing. Three steps:

1. **Set `ENABLE_DOCKER=true` in `.env`:**
   ```env
   ENABLE_DOCKER=true
   ```

2. **Uncomment the socket mount** in `docker-compose.yml`:
   ```yaml
   volumes:
     # ...
     - /var/run/docker.sock:/var/run/docker.sock
   ```

3. **Rebuild** — the Docker CLI is only installed at build time:
   ```bash
   docker compose up -d --build
   ```

**How it works:** The image installs `docker-ce-cli`, `docker-buildx-plugin`,
and `docker-compose-plugin` (gated on the `ENABLE_DOCKER` build arg). At
startup, the entrypoint detects the mounted socket's group GID, creates a
matching group, adds the `agent` user to it, and launches the server with
`setpriv --init-groups` so that supplemental group membership takes effect.

> **⚠️ Warning:** Mounting the Docker socket gives the agent full control over
> Docker on your server — including the ability to run arbitrary containers,
> access host files, and potentially escalate to root on the host. Only enable
> this on a trusted, isolated server.

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
