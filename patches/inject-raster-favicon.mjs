#!/usr/bin/env node
/**
 * Build-time codegen: add a raster (PNG) favicon alongside the SVG one.
 *
 * AgentOS ships `app/icon.svg` (Next App Router file convention), which Next
 * emits as `<link rel="icon" type="image/svg+xml">`. That's a fine browser-tab
 * favicon, but when a mobile browser adds AgentOS to the home screen as a plain
 * *shortcut* (i.e. not a full PWA/WebAPK install — common when the origin isn't
 * a secure HTTPS context), some launchers won't rasterise an SVG favicon and
 * fall back to a generated letter tile instead of the app icon.
 *
 * Dropping a PNG at `app/icon.png` makes Next emit a second `<link rel="icon"
 * type="image/png">`, giving those shortcut/letter fallbacks a real raster
 * image to use. The real fix for a proper install is serving over HTTPS, but
 * this is cheap insurance for the shortcut case. We reuse the existing
 * public/icons/icon-192.png (the blue robot) so the favicon matches the PWA
 * icon.
 *
 * Idempotent (skips if app/icon.png already exists) and fails loudly if the
 * source PNG is missing, so an upstream icon change surfaces as a build error.
 *
 * Usage: node inject-raster-favicon.mjs [repoDir]
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const src = join(repo, "public/icons/icon-192.png");
const dest = join(repo, "app/icon.png");

if (existsSync(dest)) {
  console.log("[raster-favicon] app/icon.png already exists — no change");
  process.exit(0);
}

if (!existsSync(src)) {
  throw new Error(
    `[raster-favicon] source not found: ${src}\n` +
      `  Upstream AgentOS icon layout changed — update inject-raster-favicon.mjs.`
  );
}

copyFileSync(src, dest);
console.log("[raster-favicon] added app/icon.png (raster favicon from icon-192.png)");
