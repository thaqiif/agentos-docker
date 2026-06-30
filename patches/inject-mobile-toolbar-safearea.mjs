#!/usr/bin/env node
/**
 * Build-time codegen: shrink the empty band below the mobile terminal toolbar
 * when the on-screen keyboard is closed (iOS home-indicator area).
 *
 * The mobile layout root (MobileView) uses `h-app` = `--app-height` =
 * `window.visualViewport.height`. With the keyboard CLOSED on iOS, the visual
 * viewport excludes the bottom safe-area (home-indicator) band, so the layout
 * stops short of the screen bottom and that band shows the page background — the
 * always-visible special-keys toolbar ends up floating above a chunky empty gap.
 * With the keyboard OPEN the toolbar sits just above the keyboard, which already
 * looks right, so that case must not change.
 *
 * Two edits, both keyed off `env(safe-area-inset-bottom)`, which iOS collapses
 * to 0 while the keyboard is open (so the keyboard-open layout is byte-for-byte
 * unchanged):
 *   1. globals.css `.h-app`: add the bottom inset to the height so the layout
 *      fills down to the screen bottom when the keyboard is closed.
 *   2. TerminalToolbar: replace `py-1.5` with `pt-1.5` + a *reduced* bottom
 *      clearance (`0.375rem + 0.4 * inset`) so the keys keep a small gap above
 *      the home indicator instead of the full ~34px band.
 *
 * Idempotent and anchor-checked: each edit FAILS LOUDLY if its anchor is gone,
 * so an upstream layout change surfaces as a build error.
 *
 * Usage: node inject-mobile-toolbar-safearea.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";

const edits = [
  {
    file: "app/globals.css",
    from: `.h-app {
  height: var(--app-height, 100vh);
}`,
    to: `.h-app {
  /* Extend by the bottom safe-area inset so the mobile layout fills the
     home-indicator band when the keyboard is closed. iOS collapses the inset to
     0 while the keyboard is open, so the keyboard-adjusted height (toolbar just
     above the keyboard) is unchanged. */
  height: calc(var(--app-height, 100vh) + env(safe-area-inset-bottom));
}`,
    done: `calc(var(--app-height, 100vh) + env(safe-area-inset-bottom))`,
  },
  {
    file: "components/Terminal/TerminalToolbar.tsx",
    from: `overflow-x-auto border-t px-2 py-1.5 backdrop-blur`,
    to: `overflow-x-auto border-t px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom)*0.4)] backdrop-blur`,
    done: `pb-[calc(0.375rem+env(safe-area-inset-bottom)*0.4)]`,
  },
];

for (const { file, from, to, done } of edits) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");

  if (src.includes(done)) {
    console.log(`[toolbar-safe-area] ${file}: already patched — no change`);
    continue;
  }

  if (!src.includes(from)) {
    throw new Error(
      `[toolbar-safe-area] anchor not found in ${file}:\n${from}\n` +
        `  Upstream AgentOS changed — update inject-mobile-toolbar-safearea.mjs.`
    );
  }

  src = src.replace(from, to);
  writeFileSync(path, src);
  console.log(`[toolbar-safe-area] patched ${file}`);
}
