#!/usr/bin/env node
/**
 * Build-time codegen: make the mobile special-keys toolbar buttons a uniform
 * width with comfortable touch-target height.
 *
 * Every button in TerminalToolbar is sized purely by its content, so a narrow
 * label (arrows, `^C`) renders noticeably skinnier than a wide one (`Esc`,
 * `⇧Tab`), giving the bar a ragged look. All 11 buttons share the exact class
 * fragment `flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium`, so a
 * single replace-all standardises them: add `inline-flex items-center
 * justify-center` and a `min-w-[3.25rem]` floor (≥ the widest label) so shorter
 * buttons pad up to the same width and stay centered. `px-2.5` -> `px-2` keeps
 * the wide labels within the floor.
 *
 * `py-1.5` -> `py-2.5` gives each button 8px more height so they're easier to
 * tap on mobile. This also catches the Ctrl/Alt toggle buttons injected by
 * inject-terminal-toolbar-keys.mjs (they still carry the upstream class and get
 * swept up in the replace-all).
 *
 * Two-pass: handles both a fresh upstream source (FROM_UPSTREAM → TO) and a
 * source that was already patched with the previous, shorter TO (FROM_PATCHED
 * → TO).
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if neither fragment is found, so
 * an upstream restyle surfaces as a build error.
 *
 * Usage: node inject-toolbar-uniform-buttons.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/TerminalToolbar.tsx";
const path = join(repo, file);

const FROM_UPSTREAM = "flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium";
const FROM_PATCHED = "inline-flex items-center justify-center min-w-[3.25rem] flex-shrink-0 rounded-md px-2 py-1.5 text-xs font-medium";
const TO =
  "inline-flex items-center justify-center min-w-[3.25rem] flex-shrink-0 rounded-md px-2 py-2.5 text-xs font-medium";

let src = readFileSync(path, "utf8");

if (src.includes(TO)) {
  console.log(`[uniform-buttons] ${file}: already uniform (py-2.5) — no change`);
  process.exit(0);
}

let count = 0;
if (src.includes(FROM_UPSTREAM)) {
  count = src.split(FROM_UPSTREAM).length - 1;
  src = src.split(FROM_UPSTREAM).join(TO);
} else if (src.includes(FROM_PATCHED)) {
  count = src.split(FROM_PATCHED).length - 1;
  src = src.split(FROM_PATCHED).join(TO);
} else {
  throw new Error(
    `[uniform-buttons] neither upstream nor patched anchor found in ${file}.\n` +
      `  Upstream AgentOS restyled the toolbar — update inject-toolbar-uniform-buttons.mjs.`
  );
}

writeFileSync(path, src);
console.log(
  `[uniform-buttons] patched ${file}: standardised ${count} toolbar button(s) to min-w-[3.25rem] py-2.5`
);
