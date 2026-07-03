#!/usr/bin/env node
/**
 * Build-time codegen: register Zero (https://github.com/gitlawb/zero, npm
 * package `@gitlawb/zero`) as a first-class AgentOS provider so it shows up
 * as a selectable harness in the UI, next to Claude Code / Codex / OpenCode /
 * Command Code.
 *
 * Zero is a Go-based terminal coding agent with its own TUI and headless
 * exec mode. Unlike Claude Code (which this project wraps in profiles), Zero
 * is a standalone CLI installed via npm and managed like `command-code`.
 *
 * CLI flags (from `zero exec --help`):
 *   [prompt]                 positional initial prompt
 *   --resume                 resume the latest session
 *   --fork <session-id>      fork an existing session
 *   -m, --model <model>      pick a model
 *   --skip-permissions-unsafe  bypass all permission prompts (yolo)
 * Config/state lives under ~/.config/zero (XDG), ~/.zero, or .zero/config.json.
 *
 * The AgentOS provider list is compiled into the static bundle, so this has
 * to run before `npm run build`. It patches upstream source at well-known
 * anchors and FAILS LOUDLY if an anchor is missing, so upstream changes
 * surface as a clear build error instead of a silently-broken image.
 *
 * Usage: node inject-zero-provider.mjs [repoDir]
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
        `  Upstream AgentOS layout changed — update inject-zero-provider.mjs.`
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
        `  Upstream AgentOS layout changed — update inject-zero-provider.mjs.`
    );
  }

  const at = src.indexOf(anchor);
  writeFileSync(path, src.slice(0, at) + snippet + src.slice(at));
  console.log(`[inject] patched ${file}`);
}

console.log("[inject] registering Zero as a harness");

// 1) Provider id union. Insert after commandcode (which itself was inserted
//    after claude by inject-commandcode-provider.mjs).
patchAfter(
  "lib/providers/registry.ts",
  '  "commandcode",\n',
  '  "zero",\n'
);

// 2) Declarative provider definition (flags, resume/fork, config dir).
//    Inserted right before the "codex" entry, after the commandcode entry
//    that was inserted by inject-commandcode-provider.mjs.
patchBefore(
  "lib/providers/registry.ts",
  '  {\n    id: "codex",',
  `  {\n` +
    `    id: "zero",\n` +
    `    name: "Zero",\n` +
    `    description: "Terminal coding agent you own",\n` +
    `    cli: "zero",\n` +
    `    configDir: "~/.config/zero",\n` +
    `    autoApproveFlag: "--skip-permissions-unsafe",\n` +
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
    ` * Zero Provider\n` +
    ` * Terminal coding agent you own\n` +
    ` * (https://github.com/gitlawb/zero)\n` +
    ` */\n` +
    `export const zeroProvider: AgentProvider = {\n` +
    `  id: "zero",\n` +
    `  name: "Zero",\n` +
    `  description: "Terminal coding agent you own",\n` +
    `  command: "zero",\n` +
    `  configDir: "~/.config/zero",\n` +
    `\n` +
    `  supportsResume: true,\n` +
    `  supportsFork: true,\n` +
    `\n` +
    `  buildFlags(options: BuildFlagsOptions): string[] {\n` +
    `    const def = getProviderDefinition("zero");\n` +
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
    `      flags.push("--fork");\n` +
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
    `    /Grant/i,\n` +
    `    /Allow/i,\n` +
    `  ],\n` +
    `\n` +
    `  runningPatterns: [\n` +
    `    /thinking/i,\n` +
    `    /working/i,\n` +
    `    /generating/i,\n` +
    `    SPINNER_CHARS,\n` +
    `  ],\n` +
    `\n` +
    `  idlePatterns: [/^>\\s*$/m, /zero.*>\\s*$/im, /\\$\\s*$/m],\n` +
    `};\n\n`
);

// 4) Register the provider object in the runtime lookup map.
patchBefore(
  "lib/providers.ts",
  "  codex: codexProvider,\n",
  "  zero: zeroProvider,\n"
);

// 5) The new-session dropdown list (AGENT_OPTIONS). Insert after the
//    commandcode entry that was added by inject-commandcode-provider.mjs
//    (which itself was added after the claude entry).
patchAfter(
  "components/NewSessionDialog/NewSessionDialog.types.ts",
  `  { value: "commandcode", label: "Command Code", description: "Learns your coding taste" },\n`,
  `  { value: "zero", label: "Zero", description: "Terminal coding agent you own" },\n`
);

// 6) The project-level "Default Agent" dropdowns.
for (const file of [
  "components/Projects/NewProjectDialog.types.ts",
  "components/Projects/ProjectSettingsDialog.tsx",
]) {
  patchAfter(
    file,
    `  { value: "commandcode", label: "Command Code" },\n`,
    `  { value: "zero", label: "Zero" },\n`
  );
}

console.log("[inject] done.");
