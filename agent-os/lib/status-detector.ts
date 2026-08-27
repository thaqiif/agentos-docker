/**
 * Session Status Detection System
 *
 * States:
 * - "running" : the harness is actively working
 * - "waiting" : the harness is BLOCKED on the user (permission dialog,
 *               y/n choice, question). Nothing progresses until answered.
 * - "done"    : the harness finished its work and is idle at its input box,
 *               and the user has not looked at it since. Attention-worthy,
 *               but not blocking.
 * - "idle"    : quiet and already seen by the user, or never ran.
 * - "dead"    : the tmux session no longer exists.
 *
 * "waiting" and "done" are deliberately distinct. The previous version
 * collapsed them — any session that had ever run reported "needs input"
 * forever — which made the status row useless.
 *
 * Detection strategy, in priority order:
 *   0. State the harness reported through a hook   -> as reported
 *   1. Harness busy marker in the pane tail        -> running
 *   2. Harness prompt marker in the pane tail      -> waiting
 *   3. Pane content changed since the last tick    -> running
 *   4. Harness ready marker (idle input box)       -> done / idle
 *   5. Quiet, no ready marker, recently ran        -> done / idle
 *
 * Step 0 is the only one that is not a guess. Claude Code, Command Code,
 * Codex and OpenCode can each report some of their state directly (see
 * lib/status-hooks.ts); where they do, we believe them. The pane reader
 * below covers everything they cannot report and every harness that has no
 * hooks at all.
 *
 * Content diffing (step 3) is the harness-agnostic backbone: if what the
 * terminal is rendering changed between two samples, something is happening,
 * whatever CLI is producing it. The per-harness patterns in
 * `providers/harness-signals.ts` sharpen the edges around that.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import {
  getProviderIdFromSessionName,
  type ProviderId,
} from "@/lib/providers/registry";
import { readHookState } from "@/lib/status-hooks";
import {
  getHarnessSignals,
  CLAUDE_FAMILY,
  getFooterNoise,
  hasSpinnerGlyph,
  getUniversalReadySignals,
  BUSY_COUNTER_PATTERNS,
  isShellProvider,
} from "@/lib/providers/harness-signals";

const execAsync = promisify(exec);

const CONFIG = {
  /** Grace period after the last observed activity before we call it stopped. */
  ACTIVITY_COOLDOWN_MS: 2500,
  /** How long the tmux session list stays valid. */
  CACHE_VALIDITY_MS: 1000,
  /** Lines of pane tail used for signal matching. */
  SIGNAL_TAIL_LINES: 12,
  /** Lines of pane tail hashed for content-change detection. */
  DIFF_TAIL_LINES: 40,
} as const;

/**
 * Whimsical verbs Claude Code cycles through while working. Only meaningful
 * next to a token counter, and only for the Claude family.
 */
const WHIMSICAL_WORDS = [
  "accomplishing", "actioning", "actualizing", "baking", "brewing",
  "calculating", "cerebrating", "channelling", "churning", "clauding",
  "coalescing", "cogitating", "computing", "concocting", "conjuring",
  "considering", "contemplating", "cooking", "crafting", "creating",
  "crunching", "deciphering", "deliberating", "determining", "digesting",
  "discombobulating", "divining", "doing", "effecting", "elucidating",
  "enchanting", "envisioning", "fabricating", "fashioning", "finagling",
  "flibbertigibbeting", "forging", "forming", "generating", "germinating",
  "hatching", "herding", "honking", "hustling", "ideating", "imagining",
  "incubating", "inferring", "jiving", "manifesting", "marinating",
  "meandering", "moseying", "mulling", "mustering", "musing", "noodling",
  "percolating", "perusing", "philosophising", "pondering", "pontificating",
  "processing", "puttering", "puzzling", "reticulating", "ruminating",
  "scheming", "schlepping", "shucking", "simmering", "smooshing",
  "spelunking", "spinning", "stewing", "summoning", "synthesizing",
  "thinking", "tinkering", "transmuting", "unfurling", "unravelling",
  "vibing", "wandering", "whirring", "wibbling", "working", "wrangling",
];

export type SessionStatus = "running" | "waiting" | "done" | "idle" | "dead";

interface StateTracker {
  /** Hash of the pane tail at the previous sample. */
  lastHash: string;
  /** Wall clock of the last tick that showed activity. */
  lastActivityAt: number;
  /** True once we have seen this session actually working. */
  hasRun: boolean;
  /** The user has viewed this session since it last stopped. */
  acknowledged: boolean;
  /** Status returned on the previous tick, for transition detection. */
  lastStatus: SessionStatus | null;
}

interface SessionCache {
  data: Map<string, number>;
  updatedAt: number;
}


/**
 * Strip the things that change without meaning anything: ANSI escapes, box
 * drawing, spinner frames, and trailing whitespace. What survives is the
 * text the user would actually read.
 */
function normalizePane(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/[⠀-⣿]/g, "") // spinner frames
    .replace(/[─-╿]/g, "") // box drawing
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n");
}

function tail(text: string, lines: number): string {
  return text.split("\n").slice(-lines).join("\n");
}

function hashOf(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

/** Claude-family busy line: a whimsical verb next to a token counter. */
function hasClaudeBusyLine(haystack: string): boolean {
  if (!haystack.includes("tokens")) return false;
  return WHIMSICAL_WORDS.some((w) => haystack.includes(w));
}

class SessionStatusDetector {
  private trackers = new Map<string, StateTracker>();
  private cache: SessionCache = { data: new Map(), updatedAt: 0 };

  async refreshCache(force = false): Promise<void> {
    if (!force && Date.now() - this.cache.updatedAt < CONFIG.CACHE_VALIDITY_MS)
      return;

    try {
      // "@" separator: tmux mangles "\t" into "_" when the server runs
      // without a UTF-8 locale (LANG unset or C), which emptied this cache
      // and made every live session report "dead".
      const { stdout } = await execAsync(
        `tmux list-sessions -F '#{session_name}@#{session_activity}' 2>/dev/null || echo ""`
      );

      const newData = new Map<string, number>();
      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;
        const idx = line.lastIndexOf("@");
        if (idx === -1) continue;
        const name = line.slice(0, idx);
        const activity = line.slice(idx + 1);
        if (name && activity) newData.set(name, parseInt(activity, 10) || 0);
      }

      this.cache = { data: newData, updatedAt: Date.now() };
    } catch {
      // Keep existing cache on error
    }
  }

  sessionExists(name: string): boolean {
    return this.cache.data.has(name);
  }

  async capturePane(name: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${name}" -p 2>/dev/null || echo ""`
      );
      return stdout.replace(/\s+$/, "");
    } catch {
      return "";
    }
  }

  private getTracker(name: string): StateTracker {
    let tracker = this.trackers.get(name);
    if (!tracker) {
      tracker = {
        lastHash: "",
        lastActivityAt: 0,
        hasRun: false,
        acknowledged: true,
        lastStatus: null,
      };
      this.trackers.set(name, tracker);
    }
    return tracker;
  }

  /**
   * Classify one session from a freshly captured pane.
   *
   * Split out from getStatus so the streaming ticker can reuse a single
   * capture for both the status and the visible tail line.
   */
  classify(
    sessionName: string,
    rawPane: string,
    providerId: ProviderId | null,
    hookState: SessionStatus | null = null
  ): SessionStatus {
    const tracker = this.getTracker(sessionName);
    const now = Date.now();

    // ── 0. The harness told us ─────────────────────────────────────────
    // A reported state is fact, not inference, so it short-circuits the
    // pane heuristics entirely. Tracker bookkeeping still runs so that
    // "seen by the user" keeps working: a reported "done" the user has
    // already looked at settles to idle exactly like a detected one.
    if (hookState) {
      if (hookState === "running" || hookState === "waiting") {
        tracker.lastActivityAt = now;
        tracker.hasRun = true;
        tracker.acknowledged = false;
        return this.remember(tracker, hookState);
      }

      if (hookState === "done") {
        tracker.hasRun = true;
        return this.remember(
          tracker,
          tracker.acknowledged ? "idle" : "done"
        );
      }

      return this.remember(tracker, "idle");
    }

    const normalized = normalizePane(rawPane);

    // Drop persistent footer chrome before matching. Otherwise a mode
    // indicator or a static "esc to interrupt" hint pins the status.
    const noise = getFooterNoise(providerId);
    const denoised = noise.length
      ? normalized
          .split("\n")
          .filter((l) => !noise.some((p) => p.test(l)))
          .join("\n")
      : normalized;

    const signalTail = tail(denoised, CONFIG.SIGNAL_TAIL_LINES).toLowerCase();
    const diffTail = tail(normalized, CONFIG.DIFF_TAIL_LINES);

    const hash = hashOf(diffTail);
    const contentChanged = tracker.lastHash !== "" && tracker.lastHash !== hash;
    tracker.lastHash = hash;

    const signals = getHarnessSignals(providerId);
    const isShell = isShellProvider(providerId);

    // Provider-specific first, then the cross-harness union: a session named
    // "shell-*" may well have Claude or Codex running inside it.
    const readyMatched =
      signals.ready.some((p) => p.test(signalTail)) ||
      getUniversalReadySignals().some((p) => p.test(signalTail));

    const promptMatched = signals.prompt.some((p) => p.test(signalTail));

    // ── 1. Actively working ────────────────────────────────────────────
    // Two tiers. A spinner or a token/elapsed counter is hard evidence of
    // streaming. Plain busy *text* is soft: current Claude Code prints
    // "esc to interrupt" in its permanent footer hint even while idle, so
    // an idle input box vetoes a text-only match.
    const hardBusy =
      hasSpinnerGlyph(tail(rawPane, 6)) ||
      BUSY_COUNTER_PATTERNS.some((p) => p.test(signalTail)) ||
      (providerId !== null &&
        CLAUDE_FAMILY.has(providerId) &&
        hasClaudeBusyLine(signalTail));

    const textBusy = !isShell && signals.busy.some((p) => p.test(signalTail));

    const busyMatched = hardBusy || (textBusy && !readyMatched);

    if (busyMatched) {
      tracker.lastActivityAt = now;
      tracker.hasRun = true;
      tracker.acknowledged = false;
      return this.remember(tracker, "running");
    }

    // ── 2. Blocked on the user ─────────────────────────────────────────
    // A prompt marker outranks content change: a permission dialog with a
    // blinking caret still means the harness is stopped and waiting.
    if (promptMatched) {
      tracker.hasRun = true;
      tracker.acknowledged = false;
      return this.remember(tracker, "waiting");
    }

    // The generic "last visible line is a question" heuristic. Only trusted
    // when the harness is NOT sitting at its idle input box — otherwise a
    // question the agent merely printed in its finished output would read as
    // a blocking prompt, which is exactly the bug this separation fixes.
    if (!readyMatched && !isShell) {
      const lastLine = normalized
        .split("\n")
        .reverse()
        .find((l) => l.trim().length > 0);
      if (lastLine && lastLine.trimEnd().endsWith("?")) {
        tracker.hasRun = true;
        tracker.acknowledged = false;
        return this.remember(tracker, "waiting");
      }
    }

    // ── 3. Content moved since the last sample ─────────────────────────
    if (contentChanged) {
      tracker.lastActivityAt = now;
      tracker.hasRun = true;
      tracker.acknowledged = false;
      return this.remember(tracker, "running");
    }

    // ── 4. Within the cooldown after activity stopped ──────────────────
    // The cooldown always applies. It used to be skipped whenever a ready
    // marker matched, on the theory that a visible input box means the work
    // is definitively over. That was wrong for any harness whose "ready"
    // text is really persistent chrome: the grace period vanished and the
    // status flickered between running and done between render frames.
    if (now - tracker.lastActivityAt < CONFIG.ACTIVITY_COOLDOWN_MS) {
      return this.remember(tracker, "running");
    }

    // ── 5. Stopped ─────────────────────────────────────────────────────
    if (tracker.acknowledged || !tracker.hasRun) {
      return this.remember(tracker, "idle");
    }
    return this.remember(tracker, "done");
  }

  private remember(tracker: StateTracker, status: SessionStatus): SessionStatus {
    tracker.lastStatus = status;
    return status;
  }

  async getStatus(sessionName: string): Promise<SessionStatus> {
    await this.refreshCache();

    if (!this.sessionExists(sessionName)) {
      this.trackers.delete(sessionName);
      return "dead";
    }

    const providerId = getProviderIdFromSessionName(sessionName);
    const content = await this.capturePane(sessionName);
    const hookState = await readHookState(sessionName);
    return this.classify(sessionName, content, providerId, hookState);
  }

  /**
   * Mark a session as seen by the user. Clears "done" back to "idle" and
   * stops a resolved "waiting" from sticking around.
   */
  acknowledge(sessionName: string): void {
    const tracker = this.trackers.get(sessionName);
    if (tracker) tracker.acknowledged = true;
  }

  async getAllStatuses(names: string[]): Promise<Map<string, SessionStatus>> {
    await this.refreshCache();
    const results = await Promise.all(
      names.map(async (name) => ({ name, status: await this.getStatus(name) }))
    );
    return new Map(results.map((r) => [r.name, r.status]));
  }

  cleanup(): void {
    for (const [name] of this.trackers) {
      if (!this.sessionExists(name)) this.trackers.delete(name);
    }
  }
}

export const statusDetector = new SessionStatusDetector();
