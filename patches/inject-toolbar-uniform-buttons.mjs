#!/usr/bin/env node
/**
 * Build-time codegen: make the mobile special-keys toolbar buttons a uniform
 * width.
 *
 * Every button in TerminalToolbar is sized purely by its content, so a narrow
 * label (arrows, `^C`) renders noticeably skinnier than a wide one (`Esc`,
 * `⇧Tab`), giving the bar a ragged look. All 11 buttons share the exact class
 * fragment `flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium`, so a
 * single replace-all standardises them: add `inline-flex items-center
 * justify-center` and a `min-w-[3.25rem]` floor (≥ the widest label) so shorter
 * buttons pad up to the same width and stay centered. `px-2.5` -> `px-2` keeps
 * the wide labels within the floor. Height is untouched (`py-1.5` stays).
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if the shared fragment is gone, so
 * an upstream restyle surfaces as a build error.
 *
 * Usage: node inject-toolbar-uniform-buttons.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/TerminalToolbar.tsx";
const path = join(repo, file);

const FROM = "flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium";
const TO =
  "inline-flex items-center justify-center min-w-[3.25rem] flex-shrink-0 rounded-md px-2 py-1.5 text-xs font-medium";

let src = readFileSync(path, "utf8");

if (src.includes(TO)) {
  console.log(`[uniform-buttons] ${file}: already uniform — no change`);
  process.exit(0);
}

if (!src.includes(FROM)) {
  throw new Error(
    `[uniform-buttons] anchor not found in ${file}:\n  ${FROM}\n` +
      `  Upstream AgentOS restyled the toolbar — update inject-toolbar-uniform-buttons.mjs.`
  );
}

const count = src.split(FROM).length - 1;
src = src.split(FROM).join(TO);
writeFileSync(path, src);
console.log(
  `[uniform-buttons] patched ${file}: standardised ${count} toolbar button(s) to min-w-[3.25rem]`
);
