#!/usr/bin/env node
/**
 * Build-time codegen: add hold-to-repeat to the mobile toolbar's key-sending
 * buttons so holding a button sends repeated keystrokes like a real keyboard.
 *
 * The toolbar has two kinds of buttons:
 *   a) Config buttons (Esc, ^C, Tab, arrows, etc.) — rendered via buttons.map()
 *   b) The Enter (↵) button — rendered standalone
 *
 * Both send terminal keys via `onKeyPress()` on click/tap. This patch preserves
 * `onClick` for native keyboard and assistive-technology activation, and adds
 * Pointer Events for hold-to-repeat. A tap remains a normal click. A stationary
 * hold sends its first key after 300ms, then repeats every 50ms. Delaying that
 * first send is important: it gives a horizontal swipe time to exceed the 10px
 * movement threshold and cancel without accidentally sending a key.
 *
 * Only the primary pointer and main mouse button can start repeat. Pointer-up,
 * leave, cancel, a scroll gesture, and component unmount all clear timers.
 * Toggle buttons (⇧ ⌃ ⌥) and action buttons are unaffected.
 *
 * Idempotent (checks for `startKeyRepeat` marker) and anchor-checked: FAILS
 * LOUDLY if a required anchor is gone, so an upstream refactor of the toolbar
 * surfaces as a build error.
 *
 * Usage: node inject-toolbar-key-repeat.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";
const file = "components/Terminal/TerminalToolbar.tsx";
const path = join(repo, file);

let src = readFileSync(path, "utf8");

const edits = [
  // 1. Add useRef to the React import.
  //    The import already has useEffect (from inject-terminal-toolbar-keys) and
  //    useCallback + useState (upstream).  We just splice in useRef.
  {
    name: "import useRef",
    marker: `import { useCallback, useEffect, useRef, useState } from "react";`,
    anchor: `import { useCallback, useEffect, useState } from "react";`,
    insert: `import { useCallback, useEffect, useRef, useState } from "react";`,
  },

  // 2. Inject the gesture-safe key-repeat helpers before the visibility guard.
  //    At this point the Ctrl + Alt effects (from inject-terminal-toolbar-keys)
  //    already sit right above the guard, so we anchor on the guard line.
  {
    name: "key-repeat helpers",
    marker: "startKeyRepeat",
    anchor: `  if (!visible) return null;\n`,
    insert:
      `  // Keep taps as native clicks for keyboard/assistive-tech support. A\n` +
      `  // stationary pointer hold starts typematic repeat after 300ms; moving\n` +
      `  // 10px cancels before any key is sent so horizontal scrolling is safe.\n` +
      `  const KEY_REPEAT_MOVE_THRESHOLD = 10;\n` +
      `  const keyRepeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n` +
      `  const keyRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);\n` +
      `  const keyRepeatPointerRef = useRef<{\n` +
      `    pointerId: number;\n` +
      `    startX: number;\n` +
      `    startY: number;\n` +
      `  } | null>(null);\n` +
      `  const keyRepeatStartActionRef = useRef<(() => void) | null>(null);\n` +
      `  const suppressKeyRepeatClickRef = useRef(false);\n` +
      `  const cleanupKeyRepeat = useCallback(() => {\n` +
      `    if (keyRepeatTimerRef.current !== null) {\n` +
      `      clearTimeout(keyRepeatTimerRef.current);\n` +
      `      keyRepeatTimerRef.current = null;\n` +
      `    }\n` +
      `    if (keyRepeatIntervalRef.current !== null) {\n` +
      `      clearInterval(keyRepeatIntervalRef.current);\n` +
      `      keyRepeatIntervalRef.current = null;\n` +
      `    }\n` +
      `    keyRepeatPointerRef.current = null;\n` +
      `    keyRepeatStartActionRef.current = null;\n` +
      `  }, []);\n` +
      `  useEffect(() => cleanupKeyRepeat, [cleanupKeyRepeat]);\n` +
      `  const startKeyRepeat = useCallback(\n` +
      `    (\n` +
      `      key: string,\n` +
      `      pointerId: number,\n` +
      `      clientX: number,\n` +
      `      clientY: number,\n` +
      `      onRepeatStart?: () => void\n` +
      `    ) => {\n` +
      `      cleanupKeyRepeat();\n` +
      `      suppressKeyRepeatClickRef.current = false;\n` +
      `      keyRepeatPointerRef.current = { pointerId, startX: clientX, startY: clientY };\n` +
      `      keyRepeatStartActionRef.current = onRepeatStart ?? null;\n` +
      `      keyRepeatTimerRef.current = setTimeout(() => {\n` +
      `        keyRepeatTimerRef.current = null;\n` +
      `        if (!keyRepeatPointerRef.current) return;\n` +
      `        suppressKeyRepeatClickRef.current = true;\n` +
      `        keyRepeatStartActionRef.current?.();\n` +
      `        keyRepeatStartActionRef.current = null;\n` +
      `        onKeyPress(key);\n` +
      `        keyRepeatIntervalRef.current = setInterval(() => onKeyPress(key), 50);\n` +
      `      }, 300);\n` +
      `    },\n` +
      `    [cleanupKeyRepeat, onKeyPress]\n` +
      `  );\n` +
      `  const stopKeyRepeat = useCallback(() => {\n` +
      `    cleanupKeyRepeat();\n` +
      `  }, [cleanupKeyRepeat]);\n` +
      `  const cancelKeyRepeat = useCallback(\n` +
      `    (suppressClick: boolean) => {\n` +
      `      if (suppressClick && keyRepeatPointerRef.current) {\n` +
      `        suppressKeyRepeatClickRef.current = true;\n` +
      `      }\n` +
      `      cleanupKeyRepeat();\n` +
      `    },\n` +
      `    [cleanupKeyRepeat]\n` +
      `  );\n` +
      `  const trackKeyRepeatPointer = useCallback(\n` +
      `    (pointerId: number, clientX: number, clientY: number) => {\n` +
      `      const pointer = keyRepeatPointerRef.current;\n` +
      `      if (!pointer || pointer.pointerId !== pointerId) return;\n` +
      `      if (\n` +
      `        Math.hypot(clientX - pointer.startX, clientY - pointer.startY) >=\n` +
      `        KEY_REPEAT_MOVE_THRESHOLD\n` +
      `      ) {\n` +
      `        cancelKeyRepeat(true);\n` +
      `      }\n` +
      `    },\n` +
      `    [cancelKeyRepeat]\n` +
      `  );\n` +
      `  const consumeSuppressedClick = useCallback(() => {\n` +
      `    const suppress = suppressKeyRepeatClickRef.current;\n` +
      `    suppressKeyRepeatClickRef.current = false;\n` +
      `    return suppress;\n` +
      `  }, []);\n\n` +
      `  if (!visible) return null;\n`,
  },

  // 3. Add repeat gestures to config buttons while preserving native clicks.
  {
    name: "config-button pointer-repeat",
    marker: "startKeyRepeat(btn.key,",
    anchor:
      `            onMouseDown={(e) => e.preventDefault()}\n` +
      `            onClick={(e) => {\n` +
      `              e.stopPropagation();\n` +
      `              onKeyPress(btn.key);\n` +
      `            }}`,
    insert:
      `            onPointerDown={(e) => {\n` +
      `              if (!e.isPrimary || e.button !== 0) return;\n` +
      `              startKeyRepeat(btn.key, e.pointerId, e.clientX, e.clientY);\n` +
      `            }}\n` +
      `            onPointerMove={(e) => {\n` +
      `              trackKeyRepeatPointer(e.pointerId, e.clientX, e.clientY);\n` +
      `            }}\n` +
      `            onPointerUp={() => {\n` +
      `              stopKeyRepeat();\n` +
      `            }}\n` +
      `            onPointerLeave={() => {\n` +
      `              cancelKeyRepeat(true);\n` +
      `            }}\n` +
      `            onPointerCancel={() => {\n` +
      `              cancelKeyRepeat(true);\n` +
      `            }}\n` +
      `            onMouseDown={(e) => e.preventDefault()}\n` +
      `            onClick={(e) => {\n` +
      `              e.stopPropagation();\n` +
      `              if (e.detail !== 0 && consumeSuppressedClick()) return;\n` +
      `              onKeyPress(btn.key);\n` +
      `            }}`,
  },

  // 4. Add the same gesture to Enter, preserving its shift behavior.
  {
    name: "enter-button pointer-repeat",
    marker: "() => setShiftActive(false)",
    anchor:
      `          onMouseDown={(e) => e.preventDefault()}\n` +
      `          onClick={(e) => {\n` +
      `            e.stopPropagation();\n` +
      `            onKeyPress(shiftActive ? "\\n" : "\\r");\n` +
      `            setShiftActive(false);\n` +
      `          }}`,
    insert:
      `          onPointerDown={(e) => {\n` +
      `            if (!e.isPrimary || e.button !== 0) return;\n` +
      `            const key = shiftActive ? "\\n" : "\\r";\n` +
      `            startKeyRepeat(\n` +
      `              key,\n` +
      `              e.pointerId,\n` +
      `              e.clientX,\n` +
      `              e.clientY,\n` +
      `              () => setShiftActive(false)\n` +
      `            );\n` +
      `          }}\n` +
      `          onPointerMove={(e) => {\n` +
      `            trackKeyRepeatPointer(e.pointerId, e.clientX, e.clientY);\n` +
      `          }}\n` +
      `          onPointerUp={() => {\n` +
      `            stopKeyRepeat();\n` +
      `          }}\n` +
      `          onPointerLeave={() => {\n` +
      `            cancelKeyRepeat(true);\n` +
      `          }}\n` +
      `          onPointerCancel={() => {\n` +
      `            cancelKeyRepeat(true);\n` +
      `          }}\n` +
      `          onMouseDown={(e) => e.preventDefault()}\n` +
      `          onClick={(e) => {\n` +
      `            e.stopPropagation();\n` +
      `            if (e.detail !== 0 && consumeSuppressedClick()) return;\n` +
      `            onKeyPress(shiftActive ? "\\n" : "\\r");\n` +
      `            setShiftActive(false);\n` +
      `          }}`,
  },
];

let changed = 0;
for (const edit of edits) {
  if (src.includes(edit.marker)) {
    console.log(`[toolbar-key-repeat] ${edit.name}: already present — no change`);
    continue;
  }
  if (!src.includes(edit.anchor)) {
    throw new Error(
      `[toolbar-key-repeat] anchor not found for "${edit.name}" in ${file}:\n` +
        `  ${JSON.stringify(edit.anchor)}\n` +
        `  Upstream TerminalToolbar changed — update inject-toolbar-key-repeat.mjs.`
    );
  }
  src = src.replace(edit.anchor, edit.insert);
  changed++;
  console.log(`[toolbar-key-repeat] applied: ${edit.name}`);
}

if (changed > 0) {
  writeFileSync(path, src);
  console.log(`[toolbar-key-repeat] patched ${file} (${changed} edit(s))`);
} else {
  console.log(`[toolbar-key-repeat] ${file}: nothing to do`);
}
