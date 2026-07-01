#!/usr/bin/env node
/**
 * Build-time codegen: register Command Code (https://commandcode.ai, npm
 * package `command-code`) as a first-class AgentOS provider so it shows up
 * as a selectable harness in the UI, next to Claude Code / Codex / OpenCode.
 *
 * Unlike inject-claude-profiles.mjs (which clones the existing Claude
 * provider for extra logins), this is a brand-new CLI, so it needs its own
 * ProviderDefinition, its own AgentProvider (buildFlags + status patterns),
 * and its own entries in the three agent-picker dropdowns.
 *
 * CLI flags below were taken from `command-code`'s own --help output
 * (bin: cmd / cmdc / command-code / commandcode, all pointing at the same
 * entry point):
 *   [prompt]                 positional initial prompt
 *   -r, --resume [name]      resume a session by id/name
 *   --fork-session           used with --resume/--continue to fork
 *   -m, --model <model>      pick a model (claude-*, kimi-*, etc.)
 *   --yolo                   bypass all permission prompts
 * Config/state lives under ~/.commandcode (taste packages, auth, etc.).
 *
 * The AgentOS provider list is compiled into the static bundle, so this has
 * to run before `npm run build`. It patches upstream source at well-known
 * anchors and FAILS LOUDLY if an anchor is missing, so upstream changes
 * surface as a clear build error instead of a silently-broken image.
 *
 * Usage: node inject-commandcode-provider.mjs [repoDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || "/opt/agent-os";

/** Insert `snippet` right after `anchor`. Idempotent; throws if anchor missing. */
function patchAfter(file, anchor, snippet) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");

  if (src.includes(snippet)) {
    console.log(`[inject] ${file}: already up to date`);
    return;
  }
  if (!src.includes(anchor)) {
    throw new Error(
      `[inject] anchor not found in ${file}:\n  ${anchor.split("\n")[0]}\n` +
        `  Upstream AgentOS layout changed — update inject-commandcode-provider.mjs.`
    );
  }

  const at = src.indexOf(anchor) + anchor.length;
  writeFileSync(path, src.slice(0, at) + snippet + src.slice(at));
  console.log(`[inject] patched ${file}`);
}

/** Insert `snippet` right before `anchor`. Idempotent; throws if anchor missing. */
function patchBefore(file, anchor, snippet) {
  const path = join(repo, file);
  let src = readFileSync(path, "utf8");

  if (src.includes(snippet)) {
    console.log(`[inject] ${file}: already up to date`);
    return;
  }
  if (!src.includes(anchor)) {
    throw new Error(
      `[inject] anchor not found in ${file}:\n  ${anchor.split("\n")[0]}\n` +
        `  Upstream AgentOS layout changed — update inject-commandcode-provider.mjs.`
    );
  }

  const at = src.indexOf(anchor);
  writeFileSync(path, src.slice(0, at) + snippet + src.slice(at));
  console.log(`[inject] patched ${file}`);
}

console.log("[inject] registering Command Code as a harness");

// 1) Provider id union.
patchAfter(
  "lib/providers/registry.ts",
  '  "claude",\n',
  '  "commandcode",\n'
);

// 2) Declarative provider definition (flags, resume/fork, config dir).
//    Inserted right before the "codex" entry so it doesn't collide with
//    inject-claude-profiles.mjs, which inserts at the very top of this array.
patchBefore(
  "lib/providers/registry.ts",
  '  {\n    id: "codex",',
  `  {\n` +
    `    id: "commandcode",\n` +
    `    name: "Command Code",\n` +
    `    description: "Coding agent that learns your taste",\n` +
    `    cli: "commandcode",\n` +
    `    configDir: "~/.commandcode",\n` +
    `    autoApproveFlag: "--yolo",\n` +
    `    supportsResume: true,\n` +
    `    supportsFork: true,\n` +
    `    resumeFlag: "--resume",\n` +
    `    modelFlag: "--model",\n` +
    `    initialPromptFlag: "", // Positional argument\n` +
    `  },\n`
);

// 3) Runtime provider object (buildFlags + status detection patterns).
patchBefore(
  "lib/providers.ts",
  "export const codexProvider: AgentProvider = {",
  `/**\n` +
    ` * Command Code Provider\n` +
    ` * Coding agent that continuously learns your coding taste\n` +
    ` * (https://commandcode.ai)\n` +
    ` */\n` +
    `export const commandcodeProvider: AgentProvider = {\n` +
    `  id: "commandcode",\n` +
    `  name: "Command Code",\n` +
    `  description: "Coding agent that learns your taste",\n` +
    `  command: "commandcode",\n` +
    `  configDir: "~/.commandcode",\n` +
    `\n` +
    `  supportsResume: true,\n` +
    `  supportsFork: true,\n` +
    `\n` +
    `  buildFlags(options: BuildFlagsOptions): string[] {\n` +
    `    const def = getProviderDefinition("commandcode");\n` +
    `    const flags: string[] = [];\n` +
    `\n` +
    `    // Auto-approve flag from registry\n` +
    `    if (\n` +
    `      (options.skipPermissions || options.autoApprove) &&\n` +
    `      def.autoApproveFlag\n` +
    `    ) {\n` +
    `      flags.push(def.autoApproveFlag);\n` +
    `    }\n` +
    `\n` +
    `    if (options.model && def.modelFlag) {\n` +
    `      flags.push(\`\${def.modelFlag} \${options.model}\`);\n` +
    `    }\n` +
    `\n` +
    `    // Resume/fork\n` +
    `    if (options.sessionId && def.resumeFlag) {\n` +
    `      flags.push(\`\${def.resumeFlag} \${options.sessionId}\`);\n` +
    `    } else if (options.parentSessionId && def.resumeFlag) {\n` +
    `      flags.push(\`\${def.resumeFlag} \${options.parentSessionId}\`);\n` +
    `      flags.push("--fork-session");\n` +
    `    }\n` +
    `\n` +
    `    // Initial prompt (positional argument)\n` +
    `    if (options.initialPrompt?.trim() && def.initialPromptFlag !== undefined) {\n` +
    `      const prompt = options.initialPrompt.trim();\n` +
    `      const escapedPrompt = prompt.replace(/'/g, "'\\\\''");\n` +
    `      flags.push(\`'\${escapedPrompt}'\`);\n` +
    `    }\n` +
    `\n` +
    `    return flags;\n` +
    `  },\n` +
    `\n` +
    `  waitingPatterns: [\n` +
    `    /\\[Y\\/n\\]/i,\n` +
    `    /\\[y\\/N\\]/i,\n` +
    `    /approve/i,\n` +
    `    /confirm/i,\n` +
    `    /Press Enter/i,\n` +
    `    /\\(yes\\/no\\)/i,\n` +
    `    /Do you want to/i,\n` +
    `  ],\n` +
    `\n` +
    `  runningPatterns: [\n` +
    `    /thinking/i,\n` +
    `    /working/i,\n` +
    `    /generating/i,\n` +
    `    SPINNER_CHARS,\n` +
    `  ],\n` +
    `\n` +
    `  idlePatterns: [/^>\\s*$/m, /commandcode.*>\\s*$/im, /\\$\\s*$/m],\n` +
    `};\n\n`
);

// 4) Register the provider object in the runtime lookup map.
patchBefore(
  "lib/providers.ts",
  "  codex: codexProvider,\n",
  "  commandcode: commandcodeProvider,\n"
);

// 5) The new-session dropdown list (AGENT_OPTIONS).
patchAfter(
  "components/NewSessionDialog/NewSessionDialog.types.ts",
  `  { value: "claude", label: "Claude Code", description: "Anthropic's CLI" },\n`,
  `  { value: "commandcode", label: "Command Code", description: "Learns your coding taste" },\n`
);

// 6) The project-level "Default Agent" dropdowns.
for (const file of [
  "components/Projects/NewProjectDialog.types.ts",
  "components/Projects/ProjectSettingsDialog.tsx",
]) {
  patchAfter(
    file,
    `  { value: "claude", label: "Claude Code" },\n`,
    `  { value: "commandcode", label: "Command Code" },\n`
  );
}

console.log("[inject] done.");
