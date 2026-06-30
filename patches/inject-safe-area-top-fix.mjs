#!/usr/bin/env node
/**
 * Build-time codegen: keep the mobile top bar clear of the device status bar /
 * notch when AgentOS is installed as a home-screen web app (PWA).
 *
 * When launched standalone from the home screen, the OS removes the browser
 * chrome and hands the full screen to the page (the layout already sets
 * `viewportFit: "cover"`). AgentOS's mobile top bar — MobileTabBar, the
 * `bg-muted` row that holds the hamburger + tab navigation — sits flush at the
 * top, so it renders *underneath* the status bar and the hamburger ends up
 * overlapped/unreachable.
 *
 * The codebase already pads for `env(safe-area-inset-bottom)` in several places
 * (virtual keyboard, swipe sidebar) but never the top inset. This adds the top
 * inset to MobileTabBar's padding: the existing `py-1.5` (0.375rem top+bottom)
 * becomes `pb-1.5` plus a top padding of `calc(0.375rem + env(safe-area-inset-top))`,
 * so the bar's background extends up behind the status bar and its contents are
 * pushed below it. On browsers/devices with no inset, `env()` resolves to 0 and
 * the bar is visually unchanged.
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if the expected class string is
 * gone, so an upstream layout change surfaces as a build error.
 *
 * Usage: node inject-safe-area-top-fix.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Pane/MobileTabBar.tsx";
const path = join(repo, file);

const FROM = "bg-muted flex items-center gap-2 px-2 py-1.5";
const TO =
  "bg-muted flex items-center gap-2 px-2 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))]";

let src = readFileSync(path, "utf8");

if (src.includes(TO)) {
  console.log(`[safe-area-top] ${file}: already padded — no change`);
  process.exit(0);
}

if (!src.includes(FROM)) {
  throw new Error(
    `[safe-area-top] anchor not found in ${file}:\n  ${FROM}\n` +
      `  Upstream AgentOS layout changed — update inject-safe-area-top-fix.mjs.`
  );
}

src = src.replace(FROM, TO);
writeFileSync(path, src);
console.log(
  `[safe-area-top] patched ${file}: added env(safe-area-inset-top) to the mobile top bar`
);
