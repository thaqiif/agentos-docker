#!/usr/bin/env node
/**
 * Build-time codegen: fix the mobile terminal being hidden behind the on-screen
 * keyboard.
 *
 * Upstream's MobileView root uses `h-screen` (100vh). On mobile 100vh is the
 * *full* screen including the area behind the browser chrome and the soft
 * keyboard, so:
 *   - the always-visible special-keys toolbar (Esc/Tab/^C/arrows), which sits at
 *     the bottom of the terminal column, is pushed below the fold; and
 *   - when the keyboard opens, the prompt line + toolbar end up *behind* it, so
 *     you can't see what you're typing.
 *
 * The app already computes a keyboard-aware height: `useViewportHeight()` writes
 * `window.visualViewport.height` into the `--app-height` CSS var, and globals.css
 * ships an `.h-app { height: var(--app-height) }` helper. MobileView just doesn't
 * use it. This swaps `h-screen` -> `h-app` on the MobileView root so the layout
 * tracks the visible (keyboard-adjusted) viewport and the toolbar + prompt stay
 * on screen.
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if the expected class string is
 * gone, so an upstream layout change surfaces as a build error.
 *
 * Usage: node inject-mobile-viewport-fix.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/views/MobileView.tsx";
const path = join(repo, file);

const FROM = "flex h-screen flex-col overflow-hidden";
const TO = "flex h-app flex-col overflow-hidden";

let src = readFileSync(path, "utf8");

if (src.includes(TO)) {
  console.log(`[mobile-vp] ${file}: already using h-app — no change`);
  process.exit(0);
}

if (!src.includes(FROM)) {
  throw new Error(
    `[mobile-vp] anchor not found in ${file}:\n  ${FROM}\n` +
      `  Upstream AgentOS layout changed — update inject-mobile-viewport-fix.mjs.`
  );
}

src = src.replace(FROM, TO);
writeFileSync(path, src);
console.log(`[mobile-vp] patched ${file}: h-screen -> h-app (keyboard-aware height)`);
