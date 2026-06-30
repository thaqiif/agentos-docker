#!/usr/bin/env node
/**
 * Build-time codegen: keep the mobile side drawer clear of the device status bar
 * / notch when AgentOS is installed as a home-screen web app (PWA).
 *
 * The mobile drawer (SwipeSidebar) is `fixed top-0 bottom-0 left-0` and already
 * pads its *bottom* for `env(safe-area-inset-bottom)` via a spacer, but nothing
 * pads the top. Launched standalone (full screen, `viewportFit: "cover"`), the
 * drawer's header — the SessionList header with the add-project / add buttons —
 * renders *under* the status bar and the icons clash with it / are unreachable.
 *
 * This adds a matching top spacer (`h-[env(safe-area-inset-top)]`) above the
 * scrollable content, so the drawer's contents start below the status bar while
 * the drawer's `bg-background` still fills behind it. Resolves to 0 where there
 * is no inset, so non-PWA / desktop is unchanged.
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if the expected markup is gone, so
 * an upstream layout change surfaces as a build error.
 *
 * Usage: node inject-mobile-drawer-safearea.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/mobile/SwipeSidebar.tsx";
const path = join(repo, file);

const FROM = `{/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>`;
const TO = `{/* Safe area spacer (status bar / notch) */}
        <div className="h-[env(safe-area-inset-top)]" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>`;

let src = readFileSync(path, "utf8");

if (src.includes(`<div className="h-[env(safe-area-inset-top)]" />`)) {
  console.log(`[drawer-safe-area] ${file}: already has top spacer — no change`);
  process.exit(0);
}

if (!src.includes(FROM)) {
  throw new Error(
    `[drawer-safe-area] anchor not found in ${file}:\n${FROM}\n` +
      `  Upstream AgentOS layout changed — update inject-mobile-drawer-safearea.mjs.`
  );
}

src = src.replace(FROM, TO);
writeFileSync(path, src);
console.log(
  `[drawer-safe-area] patched ${file}: added env(safe-area-inset-top) spacer to the mobile drawer`
);
