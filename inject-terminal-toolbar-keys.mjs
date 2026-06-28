#!/usr/bin/env node
/**
 * Build-time codegen: add a Shift+Tab key and a Ctrl modifier toggle to the
 * mobile terminal's special-keys toolbar (components/Terminal/TerminalToolbar.tsx).
 *
 * Upstream's toolbar ships Esc / ^C / Tab / ^D / arrows plus a Shift toggle that
 * only affects the Enter key. Two additions:
 *
 *   1. A dedicated "⇧Tab" button that sends the ANSI back-tab sequence (CSI Z,
 *      "\x1b[Z"). This is what Claude Code's TUI listens for to cycle its modes
 *      (plan / auto-accept), and there's no other way to send it from a phone.
 *
 *   2. A "⌃" (Ctrl) modifier toggle, mirroring the existing Shift toggle. When
 *      armed, the *next* physical keystroke is converted to its control char
 *      (Ctrl+A..Z and @ [ \ ] ^ _ ?). It's captured at the window level (capture
 *      phase) so it works with the native keyboard on desktop. Mobile soft
 *      keyboards frequently don't emit a usable `keydown` (the keycode-229
 *      problem), so the on-screen ^C / ^D buttons stay as a reliable fallback.
 *
 * Each edit is idempotent (skips if its marker is already present) and
 * anchor-checked — FAILS LOUDLY if an expected anchor is gone, so an upstream
 * refactor of the toolbar surfaces as a build error instead of a silent no-op.
 *
 * Usage: node inject-terminal-toolbar-keys.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/TerminalToolbar.tsx";
const path = join(repo, file);

let src = readFileSync(path, "utf8");

// Each edit: { name, marker (idempotency probe), anchor (must exist), insert }.
// `insert` is the full replacement for `anchor` (so it must re-include `anchor`
// when we're appending rather than replacing).
const edits = [
  {
    name: "import useEffect",
    marker: `import { useCallback, useEffect, useState } from "react";`,
    anchor: `import { useCallback, useState } from "react";`,
    insert: `import { useCallback, useEffect, useState } from "react";`,
  },
  {
    name: "SHIFT_TAB sequence",
    marker: `SHIFT_TAB:`,
    anchor: `  TAB: "\\t",\n`,
    insert: `  TAB: "\\t",\n  SHIFT_TAB: "\\x1b[Z",\n`,
  },
  {
    name: "ctrlActive state",
    marker: `const [ctrlActive, setCtrlActive]`,
    anchor: `  const [shiftActive, setShiftActive] = useState(false);\n`,
    insert:
      `  const [shiftActive, setShiftActive] = useState(false);\n` +
      `  const [ctrlActive, setCtrlActive] = useState(false);\n`,
  },
  {
    name: "Ctrl keydown capture effect",
    marker: `Ctrl modifier: when armed`,
    anchor: `  if (!visible) return null;\n`,
    insert:
      `  // Ctrl modifier: when armed, the next physical keystroke is sent as a\n` +
      `  // control character (Ctrl+A..Z and @ [ \\\\ ] ^ _ ?). Captured at the window\n` +
      `  // level so it works with the native keyboard; mobile soft keyboards may\n` +
      `  // not emit keydown, which is why the on-screen ^C/^D buttons remain.\n` +
      `  useEffect(() => {\n` +
      `    if (!ctrlActive) return;\n` +
      `    const handler = (e: KeyboardEvent) => {\n` +
      `      const k = e.key;\n` +
      `      if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta")\n` +
      `        return;\n` +
      `      e.preventDefault();\n` +
      `      e.stopPropagation();\n` +
      `      if (k.length === 1) {\n` +
      `        if (k === " ") onKeyPress("\\x00");\n` +
      `        else if (k === "?") onKeyPress("\\x7f");\n` +
      `        else {\n` +
      `          const c = k.toUpperCase().charCodeAt(0);\n` +
      `          if (c >= 64 && c <= 95) onKeyPress(String.fromCharCode(c & 0x1f));\n` +
      `        }\n` +
      `      }\n` +
      `      setCtrlActive(false);\n` +
      `    };\n` +
      `    window.addEventListener("keydown", handler, true);\n` +
      `    return () => window.removeEventListener("keydown", handler, true);\n` +
      `  }, [ctrlActive, onKeyPress]);\n\n` +
      `  if (!visible) return null;\n`,
  },
  {
    name: "Ctrl toggle button",
    marker: `Ctrl modifier toggle`,
    anchor: `        >\n          ⇧\n        </button>\n`,
    insert:
      `        >\n          ⇧\n        </button>\n\n` +
      `        {/* Ctrl modifier toggle - next physical key becomes a control char */}\n` +
      `        <button\n` +
      `          type="button"\n` +
      `          onMouseDown={(e) => e.preventDefault()}\n` +
      `          onClick={(e) => {\n` +
      `            e.stopPropagation();\n` +
      `            setCtrlActive((v) => !v);\n` +
      `          }}\n` +
      `          className={cn(\n` +
      `            "flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",\n` +
      `            ctrlActive\n` +
      `              ? "bg-primary text-primary-foreground"\n` +
      `              : "bg-secondary text-secondary-foreground active:bg-primary active:text-primary-foreground"\n` +
      `          )}\n` +
      `        >\n` +
      `          ⌃\n` +
      `        </button>\n`,
  },
  {
    name: "Shift+Tab button",
    marker: `SPECIAL_KEYS.SHIFT_TAB`,
    anchor: `    { label: "Tab", key: SPECIAL_KEYS.TAB },\n`,
    insert:
      `    { label: "Tab", key: SPECIAL_KEYS.TAB },\n` +
      `    { label: "⇧Tab", key: SPECIAL_KEYS.SHIFT_TAB },\n`,
  },
];

let changed = 0;
for (const edit of edits) {
  if (src.includes(edit.marker)) {
    console.log(`[toolbar-keys] ${edit.name}: already present — no change`);
    continue;
  }
  if (!src.includes(edit.anchor)) {
    throw new Error(
      `[toolbar-keys] anchor not found for "${edit.name}" in ${file}:\n` +
        `  ${JSON.stringify(edit.anchor)}\n` +
        `  Upstream TerminalToolbar changed — update inject-terminal-toolbar-keys.mjs.`
    );
  }
  src = src.replace(edit.anchor, edit.insert);
  changed++;
  console.log(`[toolbar-keys] applied: ${edit.name}`);
}

if (changed > 0) {
  writeFileSync(path, src);
  console.log(`[toolbar-keys] patched ${file} (${changed} edit(s))`);
} else {
  console.log(`[toolbar-keys] ${file}: nothing to do`);
}
