#!/usr/bin/env node
/**
 * Build-time codegen: make the xterm.js terminal font size configurable.
 *
 * Upstream hardcodes the size in components/Terminal/hooks/terminal-init.ts as
 * `isMobile ? 11 : 14` (in two places: createTerminal + updateTerminalForMobile).
 * The size is compiled into the client bundle, so it can't be changed at runtime
 * — it has to be patched before `npm run build`. This rewrites both literals to
 * the values from TERMINAL_FONT_SIZE (desktop) and TERMINAL_FONT_SIZE_MOBILE.
 *
 * It's idempotent: it matches `isMobile ? <n> : <n>` only on the two font-size
 * lines (anchored by the `fontSize`/`newFontSize` variable names, so it never
 * touches the nearby `isMobile ? 3 : 1` scrollSensitivity line), so re-running
 * is a no-op when values are unchanged and an update when they differ. Missing
 * anchors FAIL LOUDLY so an upstream layout change surfaces as a build error.
 *
 * Usage:
 *   TERMINAL_FONT_SIZE=16 TERMINAL_FONT_SIZE_MOBILE=13 \
 *     node inject-terminal-font.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/hooks/terminal-init.ts";

// Parse + validate the requested sizes (fall back to upstream defaults).
function size(envName, fallback) {
  const raw = (process.env[envName] || "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 6 || n > 40) {
    throw new Error(
      `[font] ${envName}=${JSON.stringify(raw)} is not an integer in 6..40`
    );
  }
  return n;
}

const desktop = size("TERMINAL_FONT_SIZE", 14);
const mobile = size("TERMINAL_FONT_SIZE_MOBILE", 11);

const path = join(repo, file);
let src = readFileSync(path, "utf8");

// Each entry anchors on the variable name so we only ever rewrite the two
// font-size ternaries, never other `isMobile ? n : n` expressions in the file.
const targets = [
  { name: "fontSize", re: /(\bconst fontSize = isMobile \? )\d+( : )\d+(;)/ },
  { name: "newFontSize", re: /(\bconst newFontSize = isMobile \? )\d+( : )\d+(;)/ },
];

let changed = false;
for (const { name, re } of targets) {
  if (!re.test(src)) {
    throw new Error(
      `[font] anchor not found for '${name}' in ${file}\n` +
        `  Upstream AgentOS layout changed — update inject-terminal-font.mjs.`
    );
  }
  const next = src.replace(re, `$1${mobile}$2${desktop}$3`);
  if (next !== src) changed = true;
  src = next;
}

if (changed) {
  writeFileSync(path, src);
  console.log(`[font] set terminal font size: ${desktop}px desktop / ${mobile}px mobile`);
} else {
  console.log(`[font] already ${desktop}px / ${mobile}px — no change`);
}
