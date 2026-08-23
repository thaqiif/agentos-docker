/**
 * Session status detector probe.
 *
 *   npx tsx scripts/status-probe.ts          # synthetic fixtures
 *   npx tsx scripts/status-probe.ts --live   # also sample real tmux sessions
 *
 * Each fixture is a real pane tail captured from the harness, classified
 * twice (the first call primes the content-diff baseline) and compared
 * against the expected state.
 *
 * When a harness reports the wrong status, add its pane here first. A
 * fixture that fails is a far cheaper bug report than a screenshot.
 */

import { statusDetector } from "@/lib/status-detector";
import { getProviderIdFromSessionName, type ProviderId } from "@/lib/providers/registry";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Real Claude/Command Code footer. Carries a permission-mode indicator at all
// times and "esc to interrupt" while a turn runs, so it must never by itself
// decide busy or ready.
const CC_FOOTER =
  "  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt · ← for agents      /rc";

type Case = [label: string, provider: ProviderId, pane: string, expected: string];

const CASES: Case[] = [
  // ── Claude Code / Command Code ─────────────────────────────────────────
  [
    "cc busy, sub-minute counter",
    "claude",
    `✻ Wrangling… (29s · ↑ 1.5k tokens)\n${CC_FOOTER}`,
    "running",
  ],
  [
    "cc busy, 1m+ counter",
    "commandcode",
    `✶ Flambéing… (1m 12s · ↓ 3.0k tokens)\n  ⎿  Tip: use git worktrees\n${CC_FOOTER}`,
    "running",
  ],
  ["cc idle at composer", "commandcode", `❯ \n${CC_FOOTER}`, "idle"],
  ["cc idle, claude profile", "claude", `❯ \n  ? for shortcuts\n${CC_FOOTER}`, "idle"],
  [
    "cc permission dialog",
    "claude",
    "Do you want to make this edit to foo.ts?\n❯ 1. Yes\n  2. Yes, and don't ask again\n  3. No",
    "waiting",
  ],
  [
    "cc finished, question in output",
    "claude",
    `I refactored the parser. Should I also update the tests?\n\n❯ \n  ? for shortcuts\n${CC_FOOTER}`,
    "idle",
  ],

  // ── Codex ──────────────────────────────────────────────────────────────
  ["codex busy", "codex", "Working (esc to interrupt)", "running"],
  ["codex prompt", "codex", "Allow command?\n1) Yes  2) No", "waiting"],
  ["codex ready", "codex", "▌\nsend q to quit", "idle"],


  // ── Plain shell ────────────────────────────────────────────────────────
  ["shell ready", "shell", "user@host:~$ ", "idle"],
  ["shell prompt", "shell", "Are you sure you want to continue? (y/n)", "waiting"],
];

let pass = 0;
let fail = 0;

function check(label: string, got: string, expected: string) {
  const ok = got === expected;
  ok ? pass++ : fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} expected=${expected.padEnd(8)} got=${got}`
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Longer than ACTIVITY_COOLDOWN_MS, so a settled session can be observed. */
const PAST_COOLDOWN_MS = 2700;

async function runFixtures() {
  for (const [label, provider, pane, expected] of CASES) {
    const name = `probe-${label.replace(/\W+/g, "-")}`;
    statusDetector.classify(name, pane, provider); // prime the diff baseline
    check(label, statusDetector.classify(name, pane, provider), expected);
  }

  // Lifecycle: a finished session is "done" until viewed, then "idle".
  // The wait is the activity cooldown: status intentionally holds "running"
  // for a beat after output stops so it does not flicker between frames.
  const n = "probe-lifecycle";
  statusDetector.classify(n, "⠹ thinking", "codex");
  statusDetector.classify(n, "all finished\n▌\nsend q to quit", "codex");
  await sleep(PAST_COOLDOWN_MS);
  check(
    "ran then quiet -> done",
    statusDetector.classify(n, "all finished\n▌\nsend q to quit", "codex"),
    "done"
  );
  statusDetector.acknowledge(n);
  check(
    "acknowledged -> idle",
    statusDetector.classify(n, "all finished\n▌\nsend q to quit", "codex"),
    "idle"
  );

  // A single frame without the busy counter must not drop out of "running":
  // the activity cooldown exists to absorb exactly this.
  const f = "probe-flicker";
  const busy = `✶ Flambéing… (1m 12s · ↓ 3.0k tokens)\n${CC_FOOTER}`;
  statusDetector.classify(f, busy, "commandcode");
  statusDetector.classify(f, busy, "commandcode");
  check(
    "counter gap holds running",
    statusDetector.classify(f, `❯ \n${CC_FOOTER}`, "commandcode"),
    "running"
  );
}

async function runLive() {
  const { stdout } = await execAsync(
    "tmux list-sessions -F '#{session_name}' 2>/dev/null || true"
  );
  const names = stdout.trim().split("\n").filter(Boolean);
  if (!names.length) {
    console.log("\nno tmux sessions to sample");
    return;
  }

  console.log("\nlive sessions (4 samples, 1s apart):");
  for (let i = 0; i < 4; i++) {
    const row: string[] = [];
    for (const name of names) {
      const pane = await statusDetector.capturePane(name);
      row.push(
        `${name.slice(0, 18)}=${statusDetector.classify(
          name,
          pane,
          getProviderIdFromSessionName(name)
        )}`
      );
    }
    console.log(`  t+${i}s  ${row.join("  ")}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  await runFixtures();
  if (process.argv.includes("--live")) await runLive();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
