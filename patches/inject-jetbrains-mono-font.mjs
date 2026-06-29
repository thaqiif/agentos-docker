#!/usr/bin/env node
/**
 * Build-time codegen: ensure the monospace font (the xterm terminal + UI code
 * blocks) is the self-hosted JetBrains Mono.
 *
 * Upstream's xterm fontFamily already lists "JetBrains Mono" first — but the
 * font isn't actually shipped, so it silently falls back to a system monospace.
 * The Dockerfile fetches the JetBrains Mono release webfonts (woff2) into
 * public/fonts/; this patch makes them load:
 *
 *   1. app/globals.css — adds the @font-face rules (5 weights/styles pointing at
 *      /fonts/JetBrainsMono-*.woff2) and prepends "JetBrains Mono" to the Tailwind
 *      `--font-mono` token, so every `font-mono` utility / prose code block uses
 *      it (Geist Mono stays as the fallback).
 *
 * The terminal needs no edit: once the @font-face is loaded the existing xterm
 * fontFamily ('"JetBrains Mono", "Fira Code", ...') resolves to it. The UI sans
 * font (--font-sans / body) is deliberately left as Geist.
 *
 * Each edit is idempotent (skips if its marker is already present) and
 * anchor-checked — FAILS LOUDLY if an expected anchor is gone, so an upstream
 * refactor surfaces as a build error instead of a silent no-op.
 *
 * Usage: node inject-jetbrains-mono-font.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";

// The @font-face block injected at the top of globals.css. Files are produced by
// the Dockerfile and served from Next's public/ dir at /fonts/.
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
      `  font-family: "JetBrains Mono";\n` +
      `  font-style: ${style};\n` +
      `  font-weight: ${weight};\n` +
      `  font-display: swap;\n` +
      `  src: url("/fonts/JetBrainsMono-${file}.woff2") format("woff2");\n` +
      `}`
  )
  .join("\n");

const fontFaceBlock =
  `/* JetBrains Mono — self-hosted for the terminal + code blocks.\n` +
  `   woff2 files are fetched by the Dockerfile and live in /public/fonts. */\n` +
  FACES +
  `\n\n`;

const files = [
  {
    file: "app/globals.css",
    edits: [
      {
        name: "@font-face rules",
        marker: `font-family: "JetBrains Mono"`,
        anchor: `@theme inline {\n`,
        insert: fontFaceBlock + `@theme inline {\n`,
      },
      {
        name: "--font-mono token",
        marker: `--font-mono: "JetBrains Mono"`,
        anchor: `  --font-mono: var(--font-geist-mono);`,
        insert: `  --font-mono: "JetBrains Mono", var(--font-geist-mono);`,
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
      console.log(`[jetbrains-mono] ${file}: ${edit.name}: already present — no change`);
      continue;
    }
    if (!src.includes(edit.anchor)) {
      throw new Error(
        `[jetbrains-mono] anchor not found for "${edit.name}" in ${file}:\n` +
          `  ${JSON.stringify(edit.anchor)}\n` +
          `  Upstream changed — update inject-jetbrains-mono-font.mjs.`
      );
    }
    src = src.replace(edit.anchor, edit.insert);
    changed++;
    total++;
    console.log(`[jetbrains-mono] applied: ${file}: ${edit.name}`);
  }
  if (changed > 0) {
    writeFileSync(path, src);
    console.log(`[jetbrains-mono] patched ${file} (${changed} edit(s))`);
  }
}

if (total === 0) console.log(`[jetbrains-mono] nothing to do`);
