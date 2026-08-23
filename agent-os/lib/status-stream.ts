/**
 * Session Status Stream
 *
 * A single server-wide ticker that samples every managed tmux session and
 * pushes changes to subscribed clients over SSE.
 *
 * Why a singleton: the detector shells out to tmux per session. If each
 * browser tab polled independently, cost scaled with tabs x sessions. One
 * ticker sampling on behalf of everyone is strictly cheaper than the old
 * per-client polling, while being roughly 20x more responsive.
 *
 * The ticker is adaptive: it samples fast while anything is moving and backs
 * off when the whole board is quiet, so an idle machine is not paying for a
 * 1 Hz tmux sweep it does not need.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { statusDetector, type SessionStatus } from "@/lib/status-detector";
import {
  getManagedSessionPattern,
  getProviderIdFromSessionName,
  getSessionIdFromName,
  type ProviderId,
} from "@/lib/providers/registry";

const execAsync = promisify(exec);

const FAST_TICK_MS = 700; // something is running or blocked
const SLOW_TICK_MS = 1500; // everything quiet
const IDLE_SHUTDOWN_MS = 30000; // no subscribers for this long -> stop

export interface SessionStatusEntry {
  sessionName: string;
  status: SessionStatus;
  lastLine: string;
  agentType: ProviderId;
}

export type StatusSnapshot = Record<string, SessionStatusEntry>;

type Subscriber = (snapshot: StatusSnapshot) => void;

const UUID_PATTERN = getManagedSessionPattern();

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/g;

/** Last visible line of a pane, cleaned for display. */
function lastVisibleLine(pane: string): string {
  const lines = pane
    .replace(ANSI, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);
  return lines.length ? lines[lines.length - 1].trim() : "";
}

class StatusStream {
  private subscribers = new Set<Subscriber>();
  private timer: NodeJS.Timeout | null = null;
  private snapshot: StatusSnapshot = {};
  private serialized = "";
  private lastSubscriberAt = Date.now();
  private ticking = false;

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    this.lastSubscriberAt = Date.now();
    this.ensureRunning();

    // Hand the new subscriber whatever we already know, immediately.
    if (Object.keys(this.snapshot).length) fn(this.snapshot);

    return () => {
      this.subscribers.delete(fn);
      this.lastSubscriberAt = Date.now();
    };
  }

  /** Current snapshot, sampling on demand if the ticker is cold. */
  async getSnapshot(): Promise<StatusSnapshot> {
    if (!Object.keys(this.snapshot).length) await this.tick();
    return this.snapshot;
  }

  /** Mark a session seen and re-sample so the change lands immediately. */
  async acknowledge(sessionId: string): Promise<void> {
    const entry = Object.entries(this.snapshot).find(([id]) => id === sessionId);
    if (entry) statusDetector.acknowledge(entry[1].sessionName);
    await this.tick();
  }

  private ensureRunning(): void {
    if (this.timer) return;
    void this.tick();
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);

    const active = Object.values(this.snapshot).some(
      (e) => e.status === "running" || e.status === "waiting"
    );
    const delay = active ? FAST_TICK_MS : SLOW_TICK_MS;

    this.timer = setTimeout(() => {
      void this.tick().finally(() => {
        // Stop the ticker once nobody has listened for a while.
        if (
          this.subscribers.size === 0 &&
          Date.now() - this.lastSubscriberAt > IDLE_SHUTDOWN_MS
        ) {
          if (this.timer) clearTimeout(this.timer);
          this.timer = null;
          return;
        }
        this.schedule();
      });
    }, delay);

    // Never hold the process open for this.
    this.timer.unref?.();
  }

  private async listSessions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "tmux list-sessions -F '#{session_name}' 2>/dev/null || true"
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;

    try {
      await statusDetector.refreshCache(true);
      const managed = (await this.listSessions()).filter((s) =>
        UUID_PATTERN.test(s)
      );

      const next: StatusSnapshot = {};

      await Promise.all(
        managed.map(async (sessionName) => {
          const providerId = getProviderIdFromSessionName(sessionName);
          // One capture feeds both the classifier and the display tail.
          const pane = await statusDetector.capturePane(sessionName);
          const status = statusDetector.classify(sessionName, pane, providerId);

          next[getSessionIdFromName(sessionName)] = {
            sessionName,
            status,
            lastLine: lastVisibleLine(pane),
            agentType: providerId ?? "claude",
          };
        })
      );

      statusDetector.cleanup();

      const serialized = JSON.stringify(next);
      this.snapshot = next;

      // Only wake clients when something actually changed.
      if (serialized !== this.serialized) {
        this.serialized = serialized;
        for (const fn of this.subscribers) {
          try {
            fn(next);
          } catch {
            // A broken subscriber must not stall the tick.
          }
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}

// Survive Next.js dev hot-reload: one ticker per process, not per module eval.
const globalRef = globalThis as unknown as { __agentosStatusStream?: StatusStream };
export const statusStream =
  globalRef.__agentosStatusStream ?? (globalRef.__agentosStatusStream = new StatusStream());
