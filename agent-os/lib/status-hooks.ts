/**
 * Harness-reported status.
 *
 * The pane reader in status-detector.ts infers state from what a TUI is
 * drawing. That is the only option for a harness that cannot talk to us,
 * but it depends on chrome, terminal width and redraw timing — which is
 * why status was intermittent for exactly the harnesses whose footers are
 * ambiguous.
 *
 * Claude Code, Command Code, Codex and OpenCode can all report state
 * directly. Their hooks write a small JSON file per tmux session (see
 * scripts/hooks/agentos-status.sh) and this module reads it. When a report
 * is present and recent it outranks anything scraped from the pane.
 *
 * Coverage differs per harness, which is a property of their APIs:
 *   - Claude Code / Command Code: running, waiting and done, from
 *     UserPromptSubmit, PreToolUse, Notification and Stop.
 *   - Codex: done only. `notify` supports one event, agent-turn-complete,
 *     with no approval or turn-start event.
 *   - OpenCode: done from session.idle, and waiting from permission.ask
 *     where that hook fires.
 * Everything a harness cannot report still falls back to the pane reader.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { SessionStatus } from "@/lib/status-detector";

/**
 * How long a report stays authoritative.
 *
 * Hook events are edge-triggered: "running" is written when a turn starts
 * and nothing more arrives until it ends, so there is no heartbeat to renew
 * it. If a harness is killed mid-turn its last report would otherwise pin
 * the status forever, so reports age out and the pane reader takes over.
 */
const HOOK_TTL_MS = 30 * 60 * 1000;

export type HookState = "running" | "waiting" | "done" | "idle";

interface HookReport {
  session: string;
  state: HookState;
  source: string;
  at: number;
}

function statusDir(): string {
  return (
    process.env.AGENTOS_STATUS_DIR || join(homedir(), ".agent-os", "status")
  );
}

/** Mirrors the sanitising in scripts/hooks/agentos-status.sh. */
function safeName(session: string): string {
  return session.replace(/[^A-Za-z0-9._-]/g, "_");
}

const VALID: ReadonlySet<string> = new Set([
  "running",
  "waiting",
  "done",
  "idle",
]);

/**
 * The most recent report for a terminal, or null if there is none, it is
 * stale, or it is unreadable.
 */
export async function readHookState(
  sessionName: string
): Promise<SessionStatus | null> {
  const path = join(statusDir(), `${safeName(sessionName)}.json`);

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    // No report for this terminal: it is a plain shell, or a harness with
    // no hooks installed. Both are ordinary.
    return null;
  }

  let report: HookReport;
  try {
    report = JSON.parse(raw) as HookReport;
  } catch {
    // A torn read should not happen (the writer renames into place), but a
    // corrupt file must not take the status system down with it.
    return null;
  }

  if (!report || typeof report.at !== "number") return null;
  if (!VALID.has(report.state)) return null;
  if (Date.now() - report.at > HOOK_TTL_MS) return null;

  return report.state;
}
