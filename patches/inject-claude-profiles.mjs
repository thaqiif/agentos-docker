#!/usr/bin/env node
/**
 * Build-time codegen: register each Claude Code profile from CLAUDE_PROFILES as
 * a first-class AgentOS provider so it shows up as a selectable harness in the
 * UI (and launches via its `claude-<name>` wrapper with the right config dir).
 *
 * The AgentOS provider list is compiled into the static bundle, so this has to
 * run before `npm run build`. It patches upstream source at well-known anchors
 * and FAILS LOUDLY if an anchor is missing, so upstream changes surface as a
 * clear build error instead of a silently-broken image.
 *
 * Usage: CLAUDE_PROFILES="a b mimo" node inject-claude-profiles.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";

const names = [
  ...new Set(
    (process.env.CLAUDE_PROFILES || "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  ),
].filter((n) => {
  const ok = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(n);
  if (!ok) console.warn(`[inject] skipping invalid profile name: ${JSON.stringify(n)}`);
  return ok;
});

if (names.length === 0) {
  console.log("[inject] no CLAUDE_PROFILES set; leaving providers untouched.");
  process.exit(0);
}
console.log(`[inject] registering Claude profiles as harnesses: ${names.join(", ")}`);

/**
 * Insert `build(name)` snippets next to an anchor. Skips names already present
 * (idempotent). Throws if a required anchor is missing.
 */
function patch(file, anchor, build, { required = true } = {}) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");

  if (!src.includes(anchor)) {
    const msg = `[inject] anchor not found in ${file}:\n  ${anchor.split("\n")[0]}`;
    if (required) {
      throw new Error(
        `${msg}\n  Upstream AgentOS layout changed — update inject-claude-profiles.mjs.`
      );
    }
    console.warn(`${msg}\n  (optional patch skipped)`);
    return;
  }

  // Idempotency is checked against the exact snippet, not just the id string,
  // because two patches share registry.ts (inserting the id in PROVIDER_IDS must
  // not make the PROVIDERS patch think it's already done).
  const insertion = names
    .map(build)
    .filter((snippet) => !src.includes(snippet))
    .join("");

  if (!insertion) {
    console.log(`[inject] ${file}: already up to date`);
    return;
  }

  const at = src.indexOf(anchor) + anchor.length;
  writeFileSync(path, src.slice(0, at) + insertion + src.slice(at));
  console.log(`[inject] patched ${file}`);
}

// 1) Provider id union + session-name parsing. Insert BEFORE "claude" so that
//    `claude-mimo-<uuid>` session names resolve to "claude-mimo", not "claude".
patch(
  "lib/providers/registry.ts",
  "export const PROVIDER_IDS = [\n",
  (n) => `  "claude-${n}",\n`
);

// 2) Declarative provider definition (flags, resume/fork, config dir).
patch(
  "lib/providers/registry.ts",
  "export const PROVIDERS: ProviderDefinition[] = [\n",
  (n) =>
    `  {\n` +
    `    id: "claude-${n}",\n` +
    `    name: "Claude (${n})",\n` +
    `    description: "Claude Code — ${n} profile",\n` +
    `    cli: "claude-${n}",\n` +
    `    configDir: "~/.claude-profiles/${n}",\n` +
    `    autoApproveFlag: "--dangerously-skip-permissions",\n` +
    `    supportsResume: true,\n` +
    `    supportsFork: true,\n` +
    `    resumeFlag: "--resume",\n` +
    `    initialPromptFlag: "",\n` +
    `  },\n`
);

// 3) Runtime provider object — clone claudeProvider, override id/command/config.
patch(
  "lib/providers.ts",
  "export const providers: Record<AgentType, AgentProvider> = {\n",
  (n) =>
    `  "claude-${n}": {\n` +
    `    ...claudeProvider,\n` +
    `    id: "claude-${n}",\n` +
    `    name: "Claude (${n})",\n` +
    `    command: "claude-${n}",\n` +
    `    configDir: "~/.claude-profiles/${n}",\n` +
    `  },\n`
);

// 4) The new-session dropdown list (AGENT_OPTIONS). Insert after the Claude entry.
patch(
  "components/NewSessionDialog/NewSessionDialog.types.ts",
  `  { value: "claude", label: "Claude Code", description: "Anthropic's CLI" },\n`,
  (n) => `  { value: "claude-${n}", label: "Claude (${n})", description: "${n} profile" },\n`
);

// 5) The project-level "Default Agent" dropdowns. A project's default agent is
//    the harness used when you click "Start Fresh", so the profiles have to show
//    up here too. These lists are separate from the new-session one above and
//    each declare their own AGENT_OPTIONS, so patch both.
for (const file of [
  "components/Projects/NewProjectDialog.types.ts",
  "components/Projects/ProjectSettingsDialog.tsx",
]) {
  patch(
    file,
    `  { value: "claude", label: "Claude Code" },\n`,
    (n) => `  { value: "claude-${n}", label: "Claude (${n})" },\n`
  );
}

// 6) Optional: let Claude profiles use the "Fork" action too (otherwise it's
//    gated to the literal "claude" id). Best-effort — don't fail the build.
{
  const file = "components/SessionCard.tsx";
  const path = join(repo, file);
  const before = `session.agent_type === "claude" && (`;
  const after = `(session.agent_type === "claude" || session.agent_type?.startsWith("claude-")) && (`;
  let src = readFileSync(path, "utf8");
  if (src.includes(before)) {
    writeFileSync(path, src.replace(before, after));
    console.log(`[inject] patched ${file} (fork for claude-* profiles)`);
  } else {
    console.warn(`[inject] fork anchor not found in ${file} (optional patch skipped)`);
  }
}

console.log("[inject] done.");
