/**
 * Terminals.
 *
 * A terminal is a tmux session, and tmux is the only place its existence is
 * recorded. There used to be a `sessions` row mirroring each one, which
 * meant two sources of truth that drifted the moment anybody ran `tmux new`
 * in a shell, killed a session from the CLI, or restarted the server.
 *
 * Provider detection reads the running process rather than the session
 * name. A session called `shell-b7d16e2d-…` may well have Claude running in
 * it — that is the normal case now that terminals start as plain shells and
 * the user picks their harness by typing its name — so a name prefix says
 * nothing useful. `pane_current_command` says what is actually running,
 * right now, and updates by itself when the user starts or quits a CLI.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import type { ProviderId } from "@/lib/providers/registry";

const execFileAsync = promisify(execFile);

/**
 * tmux mangles "\t" into "_" when the server runs without a UTF-8 locale,
 * which is how session listing silently came back empty once before. A
 * literal two-character separator survives any locale.
 */
const SEP = "%%";

export interface Terminal {
  /** tmux session name; the terminal's identity. */
  name: string;
  /** Working directory of the session. */
  path: string;
  /** tmux's last-activity stamp, in seconds. */
  activity: number;
  /** Whether any client is currently attached. */
  attached: boolean;
  /** Harness detected from the running process, or null for a plain shell. */
  provider: ProviderId | null;
  /** Number of tmux panes, so the UI can show that a session is split. */
  panes: number;
}

/**
 * Map a process name to a harness.
 *
 * These are the four supported CLIs plus the Claude profile wrappers, which
 * exec the same binary and so report as `claude`.
 */
const COMMAND_TO_PROVIDER: Record<string, ProviderId> = {
  claude: "claude",
  "claude-a": "claude-a",
  "claude-b": "claude-b",
  "claude-c": "claude-c",
  codex: "codex",
  opencode: "opencode",
  commandcode: "commandcode",
  "command-code": "commandcode",
  cmd: "commandcode",
};

export function providerForCommand(command: string): ProviderId | null {
  return COMMAND_TO_PROVIDER[command] ?? null;
}

async function tmux(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("tmux", args);
    return stdout;
  } catch {
    // No server running, or the session vanished between calls. Both are
    // ordinary states, not errors.
    return "";
  }
}

/**
 * Which harness is running in each session, and how many panes it has.
 *
 * One `list-panes -a` covers every session, so this stays a single tmux
 * call however many terminals are open. A split session can have a harness
 * in one pane and a shell in another; the harness wins, because that is
 * what the user wants to see the status of.
 */
async function paneInfo(): Promise<
  Map<string, { provider: ProviderId | null; panes: number }>
> {
  const out = await tmux([
    "list-panes",
    "-a",
    "-F",
    `#{session_name}${SEP}#{pane_current_command}`,
  ]);

  const info = new Map<string, { provider: ProviderId | null; panes: number }>();

  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const idx = line.lastIndexOf(SEP);
    if (idx === -1) continue;

    const name = line.slice(0, idx);
    const command = line.slice(idx + SEP.length).trim();

    const existing = info.get(name) ?? { provider: null, panes: 0 };
    existing.panes += 1;
    existing.provider = existing.provider ?? providerForCommand(command);
    info.set(name, existing);
  }

  return info;
}

export async function listTerminals(): Promise<Terminal[]> {
  const out = await tmux([
    "list-sessions",
    "-F",
    `#{session_name}${SEP}#{session_path}${SEP}#{session_activity}${SEP}#{session_attached}`,
  ]);

  if (!out.trim()) return [];

  const info = await paneInfo();
  const terminals: Terminal[] = [];

  for (const line of out.split("\n")) {
    if (!line.trim()) continue;

    // Split from the right: a session name may contain the separator, a
    // path is far less likely to and the trailing fields never do.
    const parts = line.split(SEP);
    if (parts.length < 4) continue;

    const attached = parts.pop()!;
    const activity = parts.pop()!;
    const path = parts.pop()!;
    const name = parts.join(SEP);

    const detected = info.get(name);

    terminals.push({
      name,
      path,
      activity: parseInt(activity, 10) || 0,
      attached: attached.trim() !== "0",
      provider: detected?.provider ?? null,
      panes: detected?.panes ?? 1,
    });
  }

  return terminals;
}

export async function terminalExists(name: string): Promise<boolean> {
  const out = await tmux(["has-session", "-t", name]);
  // has-session prints nothing and exits non-zero when absent, which tmux()
  // turns into "". Re-check against the listing to stay unambiguous.
  if (out !== "") return true;
  const all = await listTerminals();
  return all.some((t) => t.name === name);
}

/**
 * Create a terminal.
 *
 * It starts as a plain shell. Choosing a harness is something the user does
 * by typing its name, not something the UI decides up front.
 */
export async function createTerminal(cwd: string): Promise<Terminal> {
  const name = `term-${randomUUID()}`;

  await execFileAsync("tmux", ["new-session", "-d", "-s", name, "-c", cwd]);

  // Mouse mode makes tmux's own splits usable in the browser: scrolling,
  // pane focus and divider dragging all work without a prefix key.
  await tmux(["set-option", "-t", name, "mouse", "on"]);

  return {
    name,
    path: cwd,
    activity: Math.floor(Date.now() / 1000),
    attached: false,
    provider: null,
    panes: 1,
  };
}

/**
 * Client-facing shape.
 *
 * Field names deliberately mirror what the sidebar and cards already read,
 * so the list UI did not have to be rewritten alongside the data source.
 * `id` is the tmux session name: a terminal has no other identity.
 */
export interface TerminalRecord {
  id: string;
  name: string;
  tmux_name: string;
  working_directory: string;
  project_id: string | null;
  agent_type: ProviderId | null;
  panes: number;
  attached: boolean;
  activity: number;
  /** False when the tmux session is gone; selecting it starts one again. */
  alive: boolean;
}

export function toRecord(
  terminal: Terminal,
  projectId: string | null,
  alive = true
): TerminalRecord {
  return {
    id: terminal.name,
    name: terminal.name,
    tmux_name: terminal.name,
    working_directory: terminal.path,
    project_id: projectId,
    agent_type: terminal.provider,
    panes: terminal.panes,
    attached: terminal.attached,
    activity: terminal.activity,
    alive,
  };
}

export async function killTerminal(name: string): Promise<void> {
  await execFileAsync("tmux", ["kill-session", "-t", name]);
}

export async function renameTerminal(
  name: string,
  newName: string
): Promise<void> {
  await execFileAsync("tmux", ["rename-session", "-t", name, newName]);
}
