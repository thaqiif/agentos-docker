#!/usr/bin/env node
/**
 * Build-time codegen: switch the monospace font (UI code blocks + the xterm
 * terminal) to the self-hosted Maple Mono Nerd Font.
 *
 * The Dockerfile fetches the Maple Mono NF release, compresses the weights we
 * use to woff2, and drops them in public/fonts/. This patch wires them up:
 *
 *   1. app/globals.css — adds the @font-face rules (5 weights/styles pointing at
 *      /fonts/MapleMono-NF-*.woff2) and prepends "Maple Mono NF" to the Tailwind
 *      `--font-mono` theme token, so every `font-mono` utility / prose code block
 *      renders in Maple Mono (Geist Mono stays as the fallback).
 *
 *   2. components/Terminal/hooks/terminal-init.ts — prepends "Maple Mono NF" to
 *      the xterm fontFamily stack so the terminal itself uses it (and Nerd Font
 *      glyphs in shell prompts render). The UI *sans* font (--font-sans / body)
 *      is deliberately left as Geist.
 *
 * Each edit is idempotent (skips if its marker is already present) and
 * anchor-checked — FAILS LOUDLY if an expected anchor is gone, so an upstream
 * refactor surfaces as a build error instead of a silent no-op.
 *
 * Usage: node inject-maple-mono-font.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";

// The @font-face block injected at the top of globals.css. Files are produced by
// the Dockerfile's woff2 step and served from Next's public/ dir at /fonts/.
const FACES = [
  ["normal", 400, "Regular"],
  ["italic", 400, "Italic"],
  ["normal", 600, "SemiBold"], // xterm requests fontWeightBold: "600"
  ["normal", 700, "Bold"],
  ["italic", 700, "BoldItalic"],
]
  .map(
    ([style, weight, file]) =>
      `@font-face {\n` +
      `  font-family: "Maple Mono NF";\n` +
      `  font-style: ${style};\n` +
      `  font-weight: ${weight};\n` +
      `  font-display: swap;\n` +
      `  src: url("/fonts/MapleMono-NF-${file}.woff2") format("woff2");\n` +
      `}`
  )
  .join("\n");

const fontFaceBlock =
  `/* Maple Mono NF — self-hosted Nerd Font for the terminal + code blocks.\n` +
  `   woff2 files are produced by the Dockerfile and live in /public/fonts. */\n` +
  FACES +
  `\n\n`;

const files = [
  {
    file: "app/globals.css",
    edits: [
      {
        name: "@font-face rules",
        marker: `font-family: "Maple Mono NF"`,
        anchor: `@theme inline {\n`,
        insert: fontFaceBlock + `@theme inline {\n`,
      },
      {
        name: "--font-mono token",
        marker: `--font-mono: "Maple Mono NF"`,
        anchor: `  --font-mono: var(--font-geist-mono);`,
        insert: `  --font-mono: "Maple Mono NF", var(--font-geist-mono);`,
      },
    ],
  },
  {
    file: "components/Terminal/hooks/terminal-init.ts",
    edits: [
      {
        name: "xterm fontFamily",
        marker: `"Maple Mono NF"`,
        anchor: `      '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',`,
        insert: `      '"Maple Mono NF", "JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',`,
      },
    ],
  },
];

let total = 0;
for (const { file, edits } of files) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");
  let changed = 0;
  for (const edit of edits) {
    if (src.includes(edit.marker)) {
      console.log(`[maple-mono] ${file}: ${edit.name}: already present — no change`);
      continue;
    }
    if (!src.includes(edit.anchor)) {
      throw new Error(
        `[maple-mono] anchor not found for "${edit.name}" in ${file}:\n` +
          `  ${JSON.stringify(edit.anchor)}\n` +
          `  Upstream changed — update inject-maple-mono-font.mjs.`
      );
    }
    src = src.replace(edit.anchor, edit.insert);
    changed++;
    total++;
    console.log(`[maple-mono] applied: ${file}: ${edit.name}`);
  }
  if (changed > 0) {
    writeFileSync(path, src);
    console.log(`[maple-mono] patched ${file} (${changed} edit(s))`);
  }
}

if (total === 0) console.log(`[maple-mono] nothing to do`);
