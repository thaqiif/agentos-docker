/**
 * Session Status Detection System
 *
 * States:
 * - "running" (GREEN): Sustained activity within cooldown period
 * - "waiting" (YELLOW): Cooldown expired, NOT acknowledged (needs attention)
 * - "idle" (GRAY): Cooldown expired, acknowledged (user saw it)
 * - "dead": Session doesn't exist
 *
 * Detection Strategy:
 * 1. Busy indicators + recent activity (highest priority - actively working)
 * 2. Waiting patterns - user input needed
 * 3. Spike detection - activity timestamp changes (2+ in 1s = sustained)
 * 4. Cooldown - 2s grace period after activity stops
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getProviderIdFromSessionName } from "@/lib/providers/registry";

const execAsync = promisify(exec);

// Configuration constants
const CONFIG = {
  ACTIVITY_COOLDOWN_MS: 2000, // Grace period after activity
  SPIKE_WINDOW_MS: 1000, // Window to detect sustained activity
  SUSTAINED_THRESHOLD: 2, // Changes needed to confirm activity
  CACHE_VALIDITY_MS: 2000, // How long tmux cache is valid
  RECENT_ACTIVITY_MS: 120000, // Window for "recent" activity (2 min, tmux updates slowly)
} as const;

// Detection patterns

/** Providers whose busy state uses the whimsical-verbs + token counter UI */
const CLAUDE_FAMILY = new Set(["claude", "claude-a", "claude-b", "claude-c"]);

/**
 * Busy indicators shared across terminal agent harnesses.
 * Kept conservative: only phrases shown while work streams, never in
 * approval dialogs (those belong to WAITING_PATTERNS).
 */
const GENERIC_BUSY_INDICATORS = [
  "esc to interrupt",
  "(esc to interrupt)",
  "· esc to interrupt",
  "ctrl+c to interrupt",
  "(ctrl-c to interrupt)",
];

function hasSpinner(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    // Braille spinner block (U+2800–U+28FF) used by most TUI harnesses
    if (code !== undefined && code >= 0x2800 && code <= 0x28ff) return true;
  }
  return false;
}

const WHIMSICAL_WORDS = [
  "accomplishing",
  "actioning",
  "actualizing",
  "baking",
  "booping",
  "brewing",
  "calculating",
  "cerebrating",
  "channelling",
  "churning",
  "clauding",
  "coalescing",
  "cogitating",
  "combobulating",
  "computing",
  "concocting",
  "conjuring",
  "considering",
  "contemplating",
  "cooking",
  "crafting",
  "creating",
  "crunching",
  "deciphering",
  "deliberating",
  "determining",
  "discombobulating",
  "divining",
  "doing",
  "effecting",
  "elucidating",
  "enchanting",
  "envisioning",
  "finagling",
  "flibbertigibbeting",
  "forging",
  "forming",
  "frolicking",
  "generating",
  "germinating",
  "hatching",
  "herding",
  "honking",
  "hustling",
  "ideating",
  "imagining",
  "incubating",
  "inferring",
  "jiving",
  "manifesting",
  "marinating",
  "meandering",
  "moseying",
  "mulling",
  "mustering",
  "musing",
  "noodling",
  "percolating",
  "perusing",
  "philosophising",
  "pondering",
  "pontificating",
  "processing",
  "puttering",
  "puzzling",
  "reticulating",
  "ruminating",
  "scheming",
  "schlepping",
  "shimmying",
  "shucking",
  "simmering",
  "smooshing",
  "spelunking",
  "spinning",
  "stewing",
  "sussing",
  "synthesizing",
  "thinking",
  "tinkering",
  "transmuting",
  "unfurling",
  "unravelling",
  "vibing",
  "wandering",
  "whirring",
  "wibbling",
  "wizarding",
  "working",
  "wrangling",
];

/**
 * Waiting patterns: consent/choice prompts. Word-anchored and
 * question-shaped so transcript prose doesn't false-positive.
 */
const WAITING_PATTERNS = [
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /\(y\/n\)/i,
  /\by\/n\b/i,
  /Allow\?/i,
  /Approve\?/i,
  /Continue\?/i,
  /Press Enter to/i,
  /Press (enter|return|any key)/i,
  /waiting for input/i,
  /\(yes\/no\)/i,
  /Do you want to/i,
  /Enter to confirm.*Esc to cancel/i,
  />\s*1\.\s*Yes/,
  /Yes, allow all/i,
  /allow all edits/i,
  /allow all commands/i,
  // Harness-agnostic consent phrasing (Codex/Aider/Cursor/OpenCode/etc.)
  /(allow|approve|proceed|confirm|continue|trust)[^\n]{0,60}\?/i,
  /\bapprove command\b/i,
  /\bto approve\b/i,
  /\brun this command\b/i,
];

export type SessionStatus = "running" | "waiting" | "idle" | "dead";

interface StateTracker {
  lastChangeTime: number;
  acknowledged: boolean;
  lastActivityTimestamp: number;
  spikeWindowStart: number | null;
  spikeChangeCount: number;
}

interface SessionCache {
  data: Map<string, number>;
  updatedAt: number;
}

// Content analysis helpers
function checkBusyIndicators(content: string, providerId: string | null): boolean {
  const lines = content.split("\n");
  // Focus on last 10 lines to avoid old scrollback false positives
  const recentContent = lines.slice(-10).join("\n").toLowerCase();

  // Text indicators in recent lines (generic across harnesses)
  if (GENERIC_BUSY_INDICATORS.some((ind) => recentContent.includes(ind)))
    return true;

  // Claude family: whimsical verb + token counter pattern in recent lines
  if (
    (providerId === null || CLAUDE_FAMILY.has(providerId)) &&
    recentContent.includes("tokens") &&
    WHIMSICAL_WORDS.some((w) => recentContent.includes(w))
  )
    return true;

  // Spinners in last 5 lines (braille block, shared by most TUI harnesses)
  const last5 = lines.slice(-5).join("");
  if (hasSpinner(last5)) return true;

  return false;
}

function checkWaitingPatterns(
  content: string,
  allowQuestionHeuristic: boolean
): boolean {
  const recentLines = content.split("\n").slice(-5).join("\n");

  // Universal heuristic: a quiet session whose last visible line is a
  // question is asking for input regardless of harness phrasing.
  // Suppressed right after activity bursts to avoid catching streamed
  // transcript text mid-output.
  if (allowQuestionHeuristic) {
    const lastLine = [...content.split("\n")]
      .reverse()
      .find((l) => l.trim().length > 0);
    if (lastLine && lastLine.trimEnd().endsWith("?")) return true;
  }

  return WAITING_PATTERNS.some((p) => p.test(recentLines));
}

class SessionStatusDetector {
  private trackers = new Map<string, StateTracker>();
  private cache: SessionCache = { data: new Map(), updatedAt: 0 };

  // Cache management
  async refreshCache(): Promise<void> {
    if (Date.now() - this.cache.updatedAt < CONFIG.CACHE_VALIDITY_MS) return;

    try {
      const { stdout } = await execAsync(
        `tmux list-sessions -F '#{session_name}\t#{session_activity}' 2>/dev/null || echo ""`
      );

      const newData = new Map<string, number>();
      for (const line of stdout.trim().split("\n")) {
        if (!line) continue;
        const [name, activity] = line.split("\t");
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

  getTimestamp(name: string): number {
    return this.cache.data.get(name) || 0;
  }

  async capturePane(name: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${name}" -p 2>/dev/null || echo ""`
      );
      return stdout.trim();
    } catch {
      return "";
    }
  }

  private getTracker(name: string, timestamp: number): StateTracker {
    let tracker = this.trackers.get(name);
    if (!tracker) {
      tracker = {
        lastChangeTime: Date.now() - CONFIG.ACTIVITY_COOLDOWN_MS,
        acknowledged: true,
        lastActivityTimestamp: timestamp,
        spikeWindowStart: null,
        spikeChangeCount: 0,
      };
      this.trackers.set(name, tracker);
    }
    return tracker;
  }

  // Spike detection: filters single activity spikes from sustained activity
  private processSpikeDetection(
    tracker: StateTracker,
    currentTimestamp: number
  ): "running" | null {
    const now = Date.now();
    const timestampChanged = tracker.lastActivityTimestamp !== currentTimestamp;

    if (timestampChanged) {
      tracker.lastActivityTimestamp = currentTimestamp;

      const windowExpired =
        tracker.spikeWindowStart === null ||
        now - tracker.spikeWindowStart > CONFIG.SPIKE_WINDOW_MS;

      if (windowExpired) {
        // Start new detection window
        tracker.spikeWindowStart = now;
        tracker.spikeChangeCount = 1;
      } else {
        // Within window - count change
        tracker.spikeChangeCount++;
        if (tracker.spikeChangeCount >= CONFIG.SUSTAINED_THRESHOLD) {
          // Sustained activity confirmed
          tracker.lastChangeTime = now;
          tracker.acknowledged = false;
          tracker.spikeWindowStart = null;
          tracker.spikeChangeCount = 0;
          return "running";
        }
      }
    } else if (
      tracker.spikeChangeCount === 1 &&
      tracker.spikeWindowStart !== null
    ) {
      // Check if single spike should be filtered
      if (now - tracker.spikeWindowStart > CONFIG.SPIKE_WINDOW_MS) {
        tracker.spikeWindowStart = null;
        tracker.spikeChangeCount = 0;
      }
    }

    return null;
  }

  private isInSpikeWindow(tracker: StateTracker): boolean {
    return (
      tracker.spikeWindowStart !== null &&
      Date.now() - tracker.spikeWindowStart < CONFIG.SPIKE_WINDOW_MS
    );
  }

  private isInCooldown(tracker: StateTracker): boolean {
    return Date.now() - tracker.lastChangeTime < CONFIG.ACTIVITY_COOLDOWN_MS;
  }

  private getIdleOrWaiting(tracker: StateTracker): SessionStatus {
    return tracker.acknowledged ? "idle" : "waiting";
  }

  async getStatus(sessionName: string): Promise<SessionStatus> {
    await this.refreshCache();
    const providerId = getProviderIdFromSessionName(sessionName);

    // Dead check
    if (!this.sessionExists(sessionName)) {
      this.trackers.delete(sessionName);
      return "dead";
    }

    const timestamp = this.getTimestamp(sessionName);
    const tracker = this.getTracker(sessionName, timestamp);
    const content = await this.capturePane(sessionName);

    // 1. Busy indicators in last 10 lines (highest priority - harness is actively working)
    // No activity timestamp check needed since we only look at recent terminal lines
    if (checkBusyIndicators(content, providerId)) {
      tracker.lastChangeTime = Date.now();
      tracker.acknowledged = false;
      return "running";
    }

    // 2. Waiting patterns (only if not actively running). The generic
    //    "last line is a question" heuristic stays off while the session
    //    shows fresh activity so streamed transcript text can't trip it.
    if (checkWaitingPatterns(content, !this.isInCooldown(tracker)))
      return "waiting";

    // 3. Spike detection
    const spikeResult = this.processSpikeDetection(tracker, timestamp);
    if (spikeResult) return spikeResult;

    // 4. During spike window, maintain stable status
    if (this.isInSpikeWindow(tracker)) {
      return this.isInCooldown(tracker)
        ? "running"
        : this.getIdleOrWaiting(tracker);
    }

    // 5. Cooldown check
    if (this.isInCooldown(tracker)) return "running";

    // 6. Cooldown expired
    return this.getIdleOrWaiting(tracker);
  }

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
