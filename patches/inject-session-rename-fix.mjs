#!/usr/bin/env node
/**
 * Build-time codegen: fix the in-place session rename being impossible to use.
 *
 * In components/SessionCard.tsx the "Rename" action lives inside a Radix
 * DropdownMenu (and ContextMenu). Clicking it flips the card into an inline
 * <input>, and an effect focus()es that input. But when the menu closes, Radix's
 * default `onCloseAutoFocus` restores focus to the menu *trigger* — which blurs
 * the just-focused input. The input's onBlur runs handleRename(), which calls
 * setIsEditing(false), so the field snaps back to static text before you can
 * type a single character. Upstream guards this with a 100ms timing ref
 * (justStartedEditingRef); that race is lost on slower close animations and on
 * mobile, so the rename is effectively unusable.
 *
 * The fix is the canonical one for "inline edit inside a Radix menu": tell the
 * menu NOT to auto-restore focus on close (`onCloseAutoFocus` -> preventDefault).
 * Focus then stays on the input and the spurious blur never happens. Applied to
 * both the dropdown (kebab button) and the right-click context menu.
 *
 * Each edit is idempotent (skips if `onCloseAutoFocus` is already present) and
 * anchor-checked — FAILS LOUDLY if an expected anchor is gone, so an upstream
 * refactor of the menu surfaces as a build error instead of a silent no-op.
 *
 * Usage: node inject-session-rename-fix.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/SessionCard.tsx";
const path = join(repo, file);

let src = readFileSync(path, "utf8");

const edits = [
  {
    name: "DropdownMenuContent onCloseAutoFocus",
    marker: `<DropdownMenuContent align="end" onCloseAutoFocus`,
    anchor: `<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>`,
    insert: `<DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>`,
  },
  {
    name: "ContextMenuContent onCloseAutoFocus",
    marker: `<ContextMenuContent onCloseAutoFocus`,
    anchor: `<ContextMenuContent>{renderMenuItems(true)}</ContextMenuContent>`,
    insert: `<ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>{renderMenuItems(true)}</ContextMenuContent>`,
  },
];

let changed = 0;
for (const edit of edits) {
  if (src.includes(edit.marker)) {
    console.log(`[rename-fix] ${edit.name}: already present — no change`);
    continue;
  }
  if (!src.includes(edit.anchor)) {
    throw new Error(
      `[rename-fix] anchor not found for "${edit.name}" in ${file}:\n` +
        `  ${JSON.stringify(edit.anchor)}\n` +
        `  Upstream SessionCard changed — update inject-session-rename-fix.mjs.`
    );
  }
  src = src.replace(edit.anchor, edit.insert);
  changed++;
  console.log(`[rename-fix] applied: ${edit.name}`);
}

if (changed > 0) {
  writeFileSync(path, src);
  console.log(`[rename-fix] patched ${file} (${changed} edit(s))`);
} else {
  console.log(`[rename-fix] ${file}: nothing to do`);
}
