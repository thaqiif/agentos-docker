#!/usr/bin/env node
/**
 * Build-time codegen: remove the `^D` (Ctrl-D / EOF) button from the mobile
 * special-keys toolbar.
 *
 * Ctrl-D sends EOF, which at an empty shell prompt logs you out of the session
 * — an easy mis-tap on a touch toolbar — and isn't wanted here. This drops the
 * single button entry from TerminalToolbar's `buttons` array. The CTRL_D entry
 * in the SPECIAL_KEYS map is left in place (harmless, unused).
 *
 * Idempotent and anchor-checked: FAILS LOUDLY if the expected entry is gone, so
 * an upstream restyle surfaces as a build error.
 *
 * Usage: node inject-remove-ctrl-d.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/TerminalToolbar.tsx";
const path = join(repo, file);

const FROM = `    { label: "^D", key: SPECIAL_KEYS.CTRL_D },\n`;

let src = readFileSync(path, "utf8");

if (!src.includes(`label: "^D"`)) {
  console.log(`[remove-ctrl-d] ${file}: ^D button already gone — no change`);
  process.exit(0);
}

if (!src.includes(FROM)) {
  throw new Error(
    `[remove-ctrl-d] anchor not found in ${file}:\n  ${FROM.trim()}\n` +
      `  Upstream AgentOS changed the toolbar — update inject-remove-ctrl-d.mjs.`
  );
}

src = src.replace(FROM, "");
writeFileSync(path, src);
console.log(`[remove-ctrl-d] patched ${file}: removed the ^D toolbar button`);
