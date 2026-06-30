#!/usr/bin/env node
/**
 * Build-time codegen: make the installed-app (PWA) chrome match the AgentOS
 * theme instead of showing a stray blue.
 *
 * Upstream ships `theme_color: "#3B82F6"` (blue) in both the web manifest and
 * the Next `viewport.themeColor`. On an *installed* PWA — most visibly the
 * desktop app window — the browser paints the title bar / window chrome with
 * `theme_color`, so you get a blue title bar above AgentOS's dark UI. The
 * manifest's splash `background_color` (#09090b) is also slightly off the real
 * theme background.
 *
 * AgentOS defaults to the dark theme (`defaultTheme="dark"`, and the head script
 * falls back to dark), whose `--background` is `0 0% 4%` = #0a0a0a (see
 * styles/themes.css). This rewrites the PWA colors to that background so the
 * installed window chrome and splash match the app:
 *   - public/manifest.json: theme_color + background_color -> #0a0a0a
 *   - app/layout.tsx:       viewport.themeColor            -> #0a0a0a
 *
 * Idempotent and anchor-checked: each replacement FAILS LOUDLY if its anchor is
 * gone, so an upstream colour/layout change surfaces as a build error.
 *
 * Usage: node inject-pwa-theme-color.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const BG = "#0a0a0a"; // .dark --background: 0 0% 4%

// One edit = one file + the exact anchor it expects and what it becomes.
const edits = [
  {
    file: "public/manifest.json",
    from: `"theme_color": "#3B82F6"`,
    to: `"theme_color": "${BG}"`,
  },
  {
    file: "public/manifest.json",
    from: `"background_color": "#09090b"`,
    to: `"background_color": "${BG}"`,
  },
  {
    file: "app/layout.tsx",
    from: `themeColor: "#3B82F6"`,
    to: `themeColor: "${BG}"`,
  },
];

for (const { file, from, to } of edits) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");

  if (src.includes(to)) {
    console.log(`[pwa-theme] ${file}: already ${to} — no change`);
    continue;
  }

  if (!src.includes(from)) {
    throw new Error(
      `[pwa-theme] anchor not found in ${file}:\n  ${from}\n` +
        `  Upstream AgentOS changed — update inject-pwa-theme-color.mjs.`
    );
  }

  src = src.replace(from, to);
  writeFileSync(path, src);
  console.log(`[pwa-theme] patched ${file}: ${from} -> ${to}`);
}
