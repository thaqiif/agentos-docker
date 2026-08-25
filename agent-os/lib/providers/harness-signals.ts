/**
 * Harness Signals
 *
 * Per-provider terminal fingerprints used by the status detector.
 *
 * Every supported harness renders three things we care about:
 *
 *  - BUSY    the harness is actively working (spinner, "esc to interrupt",
 *            a streaming token counter). The user should wait.
 *  - PROMPT  the harness has stopped and is *blocking on the user*: a
 *            permission dialog, a y/n choice, a numbered menu. The user
 *            must answer before anything else happens.
 *  - READY   the harness has stopped and is *idle at its input box*. Work
 *            finished; nothing is blocked. This is the signal that
 *            separates "done" from "needs input".
 *
 * READY is the important one. Without it a finished session and a session
 * stuck on a permission prompt look identical (both are "quiet"), which is
 * why the old detector reported "needs input" for everything that had ever
 * run.
 *
 * Patterns are matched against the last few rendered lines of the pane,
 * lowercased, with box-drawing characters stripped.
 */

import type { ProviderId } from "./registry";

export interface HarnessSignals {
  /** Actively working. */
  busy: RegExp[];
  /** Blocked on user input — a question, consent dialog, or choice. */
  prompt: RegExp[];
  /** Sitting at an idle input box with nothing pending. */
  ready: RegExp[];
}

/**
 * Signals shared by essentially every TUI agent. Kept deliberately narrow:
 * anything ambiguous belongs in a provider entry, not here.
 */
const COMMON: HarnessSignals = {
  busy: [
    /esc to interrupt/,
    /ctrl\+c to interrupt/,
    /ctrl-c to interrupt/,
    /press esc to cancel/,
    /\bthinking\b\s*[.…]/,
    /\bworking\b\s*[.…]/,
    /\bgenerating\b\s*[.…]/,
    /\bstreaming\b\s*[.…]/,
  ],
  prompt: [
    /\[y\/n\]/,
    /\[y\/n\/a\]/,
    /\(y\/n\)/,
    /\(yes\/no\)/,
    /\by\/n\b/,
    /press enter to continue/,
    /press \[enter\]/,
    /waiting for input/,
    /do you want to (proceed|continue|allow|apply)/,
    // NB: no bare "^? " pattern here. It looks like an inquirer-style
    // prompt but also matches Claude Code's idle "? for shortcuts" hint,
    // which made every finished Claude session read as blocked. The
    // detector's last-line-is-a-question heuristic covers the real case.
  ],
  ready: [],
};

/**
 * Per-provider overrides and additions, merged over COMMON.
 *
 * The `ready` patterns are anchored on each harness's idle input chrome —
 * the box or caret it draws when it is waiting for a new instruction rather
 * than an answer to a question.
 */
const PROVIDER_SIGNALS: Partial<Record<ProviderId, Partial<HarnessSignals>>> = {
  // ── Claude Code family ────────────────────────────────────────────────
  // Busy: "✻ Wrangling… (12s · ↑ 1.2k tokens · esc to interrupt)"
  // Prompt: numbered permission dialog "1. Yes  2. Yes, and don't ask again"
  // Ready: the "> " composer box with the shortcut hint bar beneath it.
  claude: {
    busy: [/·\s*↑?\s*[\d.]+k?\s*tokens/, /\(\d+s\s*·/],
    prompt: [
      /do you want to (make this edit|create|run|proceed)/,
      /\byes, and don't ask again\b/,
      /\byes, allow all\b/,
      /allow all (edits|commands)/,
      /^\s*❯?\s*\d\.\s+yes\b/m,
      /would you like to/,
    ],
    // "bypassing permissions", "shift+tab to cycle" and "plan mode on" were
    // here and were wrong: they are permission-MODE indicators, rendered in
    // the footer whether the harness is working or idle. Treating them as
    // ready made readyMatched permanently true, which suppressed the
    // activity cooldown and made the status flicker.
    ready: [/\? for shortcuts/],
  },

  // Command Code is a Claude Code fork: same chrome.
  commandcode: {
    busy: [/·\s*↑?\s*[\d.]+k?\s*tokens/, /\(\d+s\s*·/],
    prompt: [/^\s*❯?\s*\d\.\s+yes\b/m, /\byes, and don't ask again\b/],
    ready: [/\? for shortcuts/],
  },

  // ── OpenAI Codex CLI ──────────────────────────────────────────────────
  // Busy: "Working (esc to interrupt)" / "• Ran command"
  // Prompt: "Allow command?" with 1/2/3 choices
  // Ready: the "▌" composer with "send q to quit" style footer.
  codex: {
    busy: [/\bworking\b/, /\besc to interrupt\b/, /\brunning\b\s*[.…]/],
    prompt: [
      /allow command\?/,
      /approve (this )?command/,
      /\ballow\b.*\?\s*$/m,
      /^\s*\d\)\s+(yes|no|allow|deny)\b/m,
      /requires approval/,
    ],
    ready: [/send q to quit/, /ctrl\+d to exit/, /\/help for commands/],
  },

  // ── OpenCode ──────────────────────────────────────────────────────────
  opencode: {
    busy: [/\bthinking\b/, /\bworking\b/, /esc to interrupt/],
    prompt: [
      /\bpermission (required|request)\b/,
      /\ballow this\b/,
      /^\s*\d\.\s+(allow|deny|always)\b/m,
    ],
    ready: [/\/help\b/, /ctrl\+\w to\b/, /\bnew session\b/],
  },

  // ── Plain shell ───────────────────────────────────────────────────────
  // A shell is never "working" in the agent sense and never "asks" — it
  // either has a foreground job or sits at a prompt. Its READY signal is a
  // trailing shell prompt character, which also tells us a command finished.
  shell: {
    busy: [],
    prompt: [/\(y\/n\)/, /\[y\/n\]/, /password( for .*)?:\s*$/m, /\bcontinue\?/],
    ready: [/[$#%❯>]\s*$/],
  },
};

// claude-a/b/c are profile clones of claude — same chrome, same signals.
PROVIDER_SIGNALS["claude-a"] = PROVIDER_SIGNALS.claude;
PROVIDER_SIGNALS["claude-b"] = PROVIDER_SIGNALS.claude;
PROVIDER_SIGNALS["claude-c"] = PROVIDER_SIGNALS.claude;

const signalCache = new Map<string, HarnessSignals>();

/**
 * Resolve the merged signal set for a provider. COMMON always applies; the
 * provider's own patterns are added on top. An unknown provider gets COMMON
 * alone, which is conservative but never wrong.
 */
export function getHarnessSignals(providerId: ProviderId | null): HarnessSignals {
  const key = providerId ?? "__unknown__";
  const cached = signalCache.get(key);
  if (cached) return cached;

  const overrides = providerId ? PROVIDER_SIGNALS[providerId] : undefined;
  const merged: HarnessSignals = {
    busy: [...COMMON.busy, ...(overrides?.busy ?? [])],
    prompt: [...COMMON.prompt, ...(overrides?.prompt ?? [])],
    ready: [...COMMON.ready, ...(overrides?.ready ?? [])],
  };

  signalCache.set(key, merged);
  return merged;
}

/** Providers whose busy UI is the whimsical-verb + token-counter line. */
export const CLAUDE_FAMILY = new Set<ProviderId>([
  "claude",
  "claude-a",
  "claude-b",
  "claude-c",
  "commandcode",
]);

/** Shell sessions get no agent-style heuristics at all. */
export function isShellProvider(providerId: ProviderId | null): boolean {
  return providerId === "shell";
}

/**
 * Every harness's idle-input marker, regardless of provider.
 *
 * The provider is derived from the tmux session name prefix, but a session
 * created as "shell" can have any agent launched inside it. When that
 * happens the provider-specific set is the wrong one, so this union gives
 * the detector a second chance to recognise an idle input box.
 *
 * Used only to veto a *text* busy match, never to assert readiness on its
 * own — a spinner or token counter still outranks it.
 */
let universalReady: RegExp[] | null = null;

export function getUniversalReadySignals(): RegExp[] {
  if (universalReady) return universalReady;

  const seen = new Set<string>();
  const all: RegExp[] = [];
  for (const overrides of Object.values(PROVIDER_SIGNALS)) {
    for (const pattern of overrides?.ready ?? []) {
      if (seen.has(pattern.source)) continue;
      seen.add(pattern.source);
      all.push(pattern);
    }
  }

  universalReady = all;
  return all;
}

/**
 * The distinctive "streaming" line shape: an elapsed timer or a token
 * counter. Structural rather than lexical, so it holds across harnesses
 * and does not depend on getting the provider right.
 */
export const BUSY_COUNTER_PATTERNS: RegExp[] = [
  /[↑↓]\s*[\d.]+k?\s*tokens/,
  /[\d.]+k?\s*tokens\b/,
  // Elapsed timer. Must tolerate "1m 12s" as well as "29s" — anchoring on
  // \d+s alone stopped matching once a turn passed the one-minute mark,
  // which silently dropped long runs out of "working".
  /\((?:\d+h\s*)?(?:\d+m\s*)?\d+s\s*[·)]/,
  /\b(?:\d+m\s*)?\d+s\s*·/,
];

/**
 * Persistent chrome that must be ignored when matching signals.
 *
 * The Claude-family footer carries a permission-mode indicator and, while a
 * turn runs, an "esc to interrupt" hint. Both are footer furniture rather
 * than state: matching busy or ready text inside them produces a status
 * that never changes. These lines are dropped from the tail before any
 * pattern runs.
 */
const CLAUDE_FOOTER_NOISE: RegExp[] = [
  /^\s*[⏵>]{1,2}\s*(auto mode|bypassing permissions|accept edits|plan mode)/,
  /shift\+tab to cycle/,
  /←\s*for agents/,
];

const FOOTER_NOISE: Partial<Record<ProviderId, RegExp[]>> = {
  claude: CLAUDE_FOOTER_NOISE,
  "claude-a": CLAUDE_FOOTER_NOISE,
  "claude-b": CLAUDE_FOOTER_NOISE,
  "claude-c": CLAUDE_FOOTER_NOISE,
  commandcode: CLAUDE_FOOTER_NOISE,
};

export function getFooterNoise(providerId: ProviderId | null): RegExp[] {
  return (providerId && FOOTER_NOISE[providerId]) || [];
}

/**
 * Spinner glyphs. Braille (U+2800–U+28FF) covers most TUIs; the Claude
 * family cycles star dingbats (✢ ✳ ✶ ✻ ✽, U+2720–U+273F) instead, which the
 * braille-only check missed entirely.
 */
export function hasSpinnerGlyph(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c === undefined) continue;
    if (c >= 0x2800 && c <= 0x28ff) return true;
    if (c >= 0x2720 && c <= 0x273f) return true;
  }
  return false;
}
