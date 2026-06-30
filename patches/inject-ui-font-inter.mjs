#!/usr/bin/env node
/**
 * Build-time codegen: switch the UI (sans) font from Geist to Inter.
 *
 * Upstream loads Geist via `next/font/google` and exposes it as the
 * `--font-geist-sans` CSS variable, which globals.css maps to `--font-sans`.
 * This swaps the loader to Inter (also `next/font/google`, so it's self-hosted
 * at build time — no runtime CDN dependency, matching how the terminal font is
 * handled). The CSS variable name is kept as `--font-geist-sans` so globals.css
 * and the <body> className need no changes. The terminal/mono font (JetBrains
 * Mono / Geist_Mono) is untouched.
 *
 * Idempotent and anchor-checked: each edit FAILS LOUDLY if its anchor is gone,
 * so an upstream font change surfaces as a build error.
 *
 * Usage: node inject-ui-font-inter.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "app/layout.tsx";
const path = join(repo, file);

const edits = [
  {
    from: `import { Geist, Geist_Mono } from "next/font/google";`,
    to: `import { Inter, Geist_Mono } from "next/font/google";`,
    done: `import { Inter, Geist_Mono } from "next/font/google";`,
  },
  {
    from: `const geistSans = Geist({`,
    to: `const geistSans = Inter({`,
    done: `const geistSans = Inter({`,
  },
];

let src = readFileSync(path, "utf8");
let changed = false;

for (const { from, to, done } of edits) {
  if (src.includes(done)) {
    console.log(`[ui-font] ${file}: already using Inter (${to}) — no change`);
    continue;
  }
  if (!src.includes(from)) {
    throw new Error(
      `[ui-font] anchor not found in ${file}:\n  ${from}\n` +
        `  Upstream AgentOS changed its fonts — update inject-ui-font-inter.mjs.`
    );
  }
  src = src.replace(from, to);
  changed = true;
  console.log(`[ui-font] patched ${file}: ${from} -> ${to}`);
}

if (changed) writeFileSync(path, src);
