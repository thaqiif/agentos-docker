# AgentOS Docker

> Self-host [**AgentOS**](https://github.com/saadnvd1/agent-os) — the mobile-first
> web UI for driving AI coding agents — as a single Docker container, with a few
> quality-of-life touches for self-hosters and phone users.

Run Claude Code, Codex, OpenCode, and Command Code from your browser (including
your phone), fully self-hosted, with `docker compose up -d`.

## What is this?

[AgentOS](https://github.com/saadnvd1/agent-os) (by
[@saadnvd1](https://github.com/saadnvd1)) is a lovely open-source, mobile-first
web app that lets you start and manage AI coding-agent sessions from any browser.

**This repo is not a fork or a replacement** — it's a packaging layer. It clones
the upstream project at build time and ships it as a reproducible, self-hostable
Docker image, then adds a handful of small, optional conveniences on top
(persistent logins, multiple Claude accounts, a friendlier mobile keyboard, an
autonomous TDD workflow, a couple of bundled CLIs).

It exists for one reason: to make AgentOS effortless to **self-host and keep
running** — one command to start, your logins and history survive restarts, and
your phone behaves. Nothing here changes what AgentOS *is*; upstream remains the
source of truth.

## Credit & relationship to upstream

All the real work — the app, the design, the UX — is
[@saadnvd1](https://github.com/saadnvd1)'s. If you find this useful, please go
[⭐ star **agent-os**](https://github.com/saadnvd1/agent-os) first. 💛

A few principles this repo tries to honour:

- **Packaging, not forking.** We clone upstream and patch it transparently at
  build time — we don't vendor a modified copy or hide changes.
- **Additive & reversible.** Every enhancement is a small build-time codegen
  patch (in [`patches/`](patches/)) that *anchors* on upstream code and **fails
  loudly** if upstream changes, so nothing silently diverges.
- **Fixes go home.** Where we fix a bug in AgentOS itself (e.g. the mobile
  keyboard overlap), the goal is to contribute it back upstream.
- **Upstream owns the app.** For questions about AgentOS itself, see the official
  [docs](https://runagentos.com/docs).

## What this image adds over upstream

| Enhancement | What you get | More |
|---|---|---|
| 🔐 **Persistent logins & state** | Authenticate each agent once — logins, projects, and session history survive restarts and rebuilds | [Volumes](#volumes--persistence) |
| 👥 **Multiple Claude accounts** | Run `claude`, `claude-a`, `claude-b`… side by side, each its own login, selectable in the UI | [Logins](#multiple-claude-code-logins) |
| 📱 **Friendlier mobile keyboard** | Keyboard-overlap fix, plus toolbar keys for newline, ⇧Tab, and ⌃/⌥ modifiers | [Mobile](#mobile) |
| 🤖 **Autopilotagent TDD workflow** | `autopilotagent` skills/commands/hooks for Claude, Codex, OpenCode, Command Code | [Autopilotagent](#autopilotagent-tdd-workflow) |
| 🔤 **JetBrains Mono code font** | Terminal & UI code blocks render in self-hosted JetBrains Mono; xterm size still configurable from `.env` | [Font](#terminal--code-font) |
| 🧰 **Bundled CLIs** | `gh`, `git`, `ripgrep`, `tmux`, `jq` preinstalled in every session | [Agents](#installed-agents) |
| 🌐 **Headless browser** | Chromium + system libs baked in so agents can render & screenshot the frontends they build | [Browser](#browser-verification) |
| 👤 **Host-matched file ownership** | `PUID`/`PGID` so files in your mounted workspace stay owned by *you* | [Permissions](#file-permissions-puid--pgid) |
| 🩹 **Quality-of-life fixes** | Inline session rename works again (upstream Radix focus-restore bug) | [Font & fixes](#terminal--code-font) |
| 📌 **Reproducible builds** | Upstream pinned to a commit; transparent patches that fail loudly on drift | [Pinning](#upstream-version-pinning) |

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
| `PUID` / `PGID` | `1000` / `1000` | Host user/group IDs to run as, so workspace files stay yours |
| `CLAUDE_PROFILES` | `a b c` | Extra Claude logins to generate (rebuild to change — it's also a build arg) |
| `TERMINAL_FONT_SIZE` | `16` | Desktop xterm font size, px (rebuild to change) |
| `TERMINAL_FONT_SIZE_MOBILE` | `13` | Mobile xterm font size, px (rebuild to change) |
| `ENABLE_DOCKER` | `false` | Install Docker CLI and allow access to host Docker socket (rebuild to change) |

Build args (passed at **build** time, e.g. `docker compose build --build-arg NAME=value`):

| Build arg | Default | What it does |
|---|---|---|
| `AGENT_OS_REF` | pinned commit SHA | Which upstream AgentOS ref to build — SHA, tag, or branch ([Pinning](#upstream-version-pinning)) |
| `AUTOPILOT_REF` | `multi-agent-support` | Which [autopilotagent](#autopilotagent-tdd-workflow) ref to bundle |
| `JETBRAINS_MONO_REF` | `v2.304` | Which [JetBrains Mono](#terminal--code-font) release to self-host for the terminal/code font |
| `CLAUDE_PROFILES` | `a b c` | Compiled into the UI's harness list (also read from `.env`) |
| `ENABLE_DOCKER` | `false` | Whether to install Docker CLI (`true`/`false`) |
| `TERMINAL_FONT_SIZE` / `…_MOBILE` | `16` / `13` | Compiled into the client bundle |

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
| `INSTALL_JETBRAINS_MONO_FONT` | Self-hosted code font | Falls back to system monospace |
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
- **Command Code** — coding agent that learns your coding taste
  ([commandcode.ai](https://commandcode.ai))

Plus a few supporting CLI tools on `PATH` inside every session:

- **GitHub CLI (`gh`)** — installed from GitHub's official apt repo for PRs,
  issues, and authenticated git over HTTPS. Run `gh auth login` once; the token
  lands in `~/.config`, which is in the persisted home volume, so it survives
  restarts.
- **git**, **ripgrep (`rg`)**, **tmux** — version control, code search, and the
  terminal multiplexer that drives AgentOS sessions.

(AgentOS itself — the web UI — runs the whole thing.)

Each agent CLI is **individually gated** so you don't ship (or wait on) tools you
never use. All default to installed; flip any off in `.env` and rebuild:

```env
INSTALL_CLAUDE_CODE=true
INSTALL_CODEX=false        # skip OpenAI Codex
INSTALL_OPENCODE=true
INSTALL_COMMAND_CODE=false # skip Command Code
```

> Leave `INSTALL_CLAUDE_CODE` on unless you only drive the other agents — turning
> it off removes the `claude` binary, so the `claude`/`claude-*` harnesses and
> profile wrappers stop working.

## Browser verification

Agents that build web frontends often want to *see* their work — render the page
and take a screenshot to check layout and styling, not just lint the code. A
plain Chromium binary can't do that here: it needs a stack of system libraries
(`libglib`, `libnss3`, `libatk`, …) that only root can `apt-get install`, and
agent sessions run as the non-root `agent` user with no `sudo`. Installing them
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
codegen step ([`inject-claude-profiles.mjs`](patches/inject-claude-profiles.mjs))
registers each profile as an AgentOS provider.

(All these build-time patch scripts live in [`patches/`](patches/).)

## Terminal & Code Font

**JetBrains Mono.** The in-browser terminal and the UI's code blocks render in
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono). Upstream's xterm
config already names it first, but the font isn't actually shipped — so without
this it falls back to a system monospace. The rest of the UI keeps its Geist sans
typeface. The font is **self-hosted** — the build downloads the official release
`woff2` webfonts and serves them from the app, so there's no runtime CDN
dependency. Pinned via the `JETBRAINS_MONO_REF` build arg (default `v2.304`).

**Configurable size.** The xterm.js font size is set via `.env`:

```env
TERMINAL_FONT_SIZE=16          # desktop viewports
TERMINAL_FONT_SIZE_MOBILE=13   # mobile viewports (< 768px wide)
```

Upstream hardcodes these at `14` / `11`; the defaults here bump them up a little.
Both the font swap and the size are **compiled into the client bundle**, so
changes take effect on a rebuild:

```bash
docker compose up -d --build
```

Build-time codegen steps patch the upstream source before the build:
[`inject-jetbrains-mono-font.mjs`](patches/inject-jetbrains-mono-font.mjs) wires up
the `@font-face` rules + `--font-mono` token, and
[`inject-terminal-font.mjs`](patches/inject-terminal-font.mjs) sets the sizes.

The UI (sans) font is also swapped from upstream's Geist to **Inter**
([`inject-ui-font-inter.mjs`](patches/inject-ui-font-inter.mjs)) — still loaded via
`next/font/google` (self-hosted at build, no runtime CDN), reusing the existing
`--font-geist-sans` variable so nothing else changes. The terminal/mono font is
untouched.

### Bug fixes

We also patch a couple of upstream rough edges (same anchor-checked codegen
approach, so they no-op cleanly if upstream fixes them first):

- **Inline session rename.** Renaming a session from its menu used to snap the
  text field straight back to read-only before you could type. The "Rename" item
  lives in a Radix menu whose default close behaviour restores focus to the
  trigger, which blurred the freshly-opened input.
  [`inject-session-rename-fix.mjs`](patches/inject-session-rename-fix.mjs) stops
  that focus restoration so the field stays editable on both desktop and mobile.

## Mobile

On a phone (viewport < 768px) the terminal shows an always-visible **special-keys
toolbar** — Esc, Tab, Ctrl-C, Ctrl-D, arrow keys, plus paste/mic/copy — for keys
a touch keyboard lacks. It appears automatically; there's nothing to enable.

This image adds a few more keys to that toolbar
([`inject-terminal-toolbar-keys.mjs`](patches/inject-terminal-toolbar-keys.mjs)):

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
`useViewportHeight()` → `--app-height`, so a build-time codegen step
([`inject-mobile-viewport-fix.mjs`](patches/inject-mobile-viewport-fix.mjs)) switches the
root to the keyboard-aware `h-app` height. The prompt and toolbar then stay above
the keyboard.

The toolbar buttons were also sized purely by their label, so narrow keys (arrows,
`^C`) looked skinnier than wide ones (`Esc`, `⇧Tab`).
([`inject-toolbar-uniform-buttons.mjs`](patches/inject-toolbar-uniform-buttons.mjs))
gives every button a `min-w-[3.25rem]` floor and centers its content, so they all
render the same width. The `^D` (Ctrl-D / EOF) key is also dropped from the toolbar
([`inject-remove-ctrl-d.mjs`](patches/inject-remove-ctrl-d.mjs)) — an easy mis-tap
that logs you out of the shell.

It also carries a safe-area fix for installing AgentOS as a home-screen **web app
(PWA)**: launched standalone, the page gets the full screen (the layout sets
`viewportFit: "cover"`), so the mobile top bar — the `bg-muted` row with the
hamburger and tab navigation — would render *under* the device status bar / notch
and overlap it. A build-time codegen step
([`inject-safe-area-top-fix.mjs`](patches/inject-safe-area-top-fix.mjs)) adds
`env(safe-area-inset-top)` to that bar's top padding, so it sits below the status
bar. On devices/browsers with no inset, `env()` resolves to 0 and nothing changes.

The mobile side drawer (`SwipeSidebar`) had the same problem at the top: it's
`fixed top-0 bottom-0` and already pads the *bottom* inset, but its header (the
session list's add-project / add buttons) rendered under the status bar in a PWA.
([`inject-mobile-drawer-safearea.mjs`](patches/inject-mobile-drawer-safearea.mjs))
adds a matching `env(safe-area-inset-top)` spacer above the drawer content so the
buttons clear the status bar.

Related: upstream sets the PWA `theme_color` to blue (`#3B82F6`) in both the web
manifest and `viewport.themeColor`. On an **installed** app — most visibly the
desktop app window — the browser tints the title bar / window chrome with that
colour, so you get a blue title bar above AgentOS's dark UI. AgentOS defaults to
the dark theme (`--background: #0a0a0a`), so
([`inject-pwa-theme-color.mjs`](patches/inject-pwa-theme-color.mjs)) rewrites the
manifest `theme_color`/`background_color` and `viewport.themeColor` to that
background, so the installed window chrome and splash match the app.

A note on the home-screen icon: a *real* PWA install (Android WebAPK / iOS
standalone), which uses the manifest icons, requires a **secure HTTPS origin**
(only `localhost` is exempt) served at a **domain root** (the manifest uses
absolute `/icons/...` paths — a subpath deployment 404s them). Over plain HTTP
the browser adds a mere *shortcut* and may show a generated letter tile. As
cheap insurance for that shortcut case,
([`inject-raster-favicon.mjs`](patches/inject-raster-favicon.mjs)) drops a PNG
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

## Upstream Version (Pinning)

The build is pinned to a specific upstream AgentOS **commit SHA** via
`ARG AGENT_OS_REF` in the [`Dockerfile`](Dockerfile), not a moving branch like
`main`. This is deliberate: the build-time patches above
([`inject-*.mjs`](Dockerfile)) match the source they were written against by
*anchoring* on specific upstream code. If upstream refactored a patched file, an
anchor would no longer match and the build would **fail loudly** rather than
silently skip the patch — good, but it means an un-pinned `main` could break a
rebuild at any time.

To move to a newer upstream version, bump `AGENT_OS_REF` (to a newer SHA, tag, or
branch) and rebuild:

```bash
docker compose build --build-arg AGENT_OS_REF=main   # or a specific SHA/tag
```

If an injector's anchor check fails after a bump, that file changed upstream —
update the matching `inject-*.mjs` script, then rebuild. The ref accepts a commit
SHA, tag, or branch.

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
