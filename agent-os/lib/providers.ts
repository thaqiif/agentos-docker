/**
 * Agent Provider Abstraction
 *
 * Defines interfaces and implementations for different AI coding CLI tools
 * (Claude Code, Codex, OpenCode, etc.)
 *
 * Uses centralized provider registry from lib/providers/registry.ts
 */

import {
  type ProviderId,
  type ProviderDefinition,
  getProviderDefinition,
  getAllProviderDefinitions,
  isValidProviderId,
} from "./providers/registry";

export type AgentType = ProviderId;

export interface AgentProvider {
  // Metadata
  id: AgentType;
  name: string;
  description: string;
  command: string;

  // Session management
  supportsResume: boolean;
  supportsFork: boolean;

  // Build the CLI command flags
  buildFlags(options: BuildFlagsOptions): string[];

  // Session ID detection (optional - not all CLIs support this)
  getSessionId?: (projectPath: string) => string | null;

  // Config directory
  configDir: string;
}

export interface BuildFlagsOptions {
  sessionId?: string | null; // For resume
  parentSessionId?: string | null; // For fork
  skipPermissions?: boolean;
  autoApprove?: boolean; // Use auto-approve flag from registry
  model?: string;
  initialPrompt?: string; // Initial prompt to send to agent
}

/**
 * Claude Code Provider
 * Anthropic's official CLI for Claude
 */
export const claudeProvider: AgentProvider = {
  id: "claude",
  name: "Claude Code",
  description: "Anthropic's official CLI",
  command: "claude",
  configDir: "~/.claude",

  supportsResume: true,
  supportsFork: true,

  buildFlags(options: BuildFlagsOptions): string[] {
    const def = getProviderDefinition("claude");
    const flags: string[] = [];

    // Auto-approve flag from registry
    if (
      (options.skipPermissions || options.autoApprove) &&
      def.autoApproveFlag
    ) {
      flags.push(def.autoApproveFlag);
    }

    // Resume/fork
    if (options.sessionId && def.resumeFlag) {
      flags.push(`${def.resumeFlag} ${options.sessionId}`);
    } else if (options.parentSessionId && def.resumeFlag) {
      flags.push(`${def.resumeFlag} ${options.parentSessionId}`);
      flags.push("--fork-session");
    }

    // Initial prompt (positional argument for Claude)
    if (options.initialPrompt?.trim() && def.initialPromptFlag !== undefined) {
      const prompt = options.initialPrompt.trim();
      // Shell-escape the prompt
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      flags.push(`'${escapedPrompt}'`);
    }

    return flags;
  },

};

/**
 * Codex Provider
 * OpenAI's CLI for code generation
 */
/**
 * Command Code Provider
 * Coding agent that continuously learns your coding taste
 * (https://commandcode.ai)
 */
export const commandcodeProvider: AgentProvider = {
  id: "commandcode",
  name: "Command Code",
  description: "Coding agent that learns your taste",
  command: "commandcode",
  configDir: "~/.commandcode",

  supportsResume: true,
  supportsFork: true,

  buildFlags(options: BuildFlagsOptions): string[] {
    const def = getProviderDefinition("commandcode");
    const flags: string[] = [];

    // Auto-approve flag from registry
    if (
      (options.skipPermissions || options.autoApprove) &&
      def.autoApproveFlag
    ) {
      flags.push(def.autoApproveFlag);
    }

    if (options.model && def.modelFlag) {
      flags.push(`${def.modelFlag} ${options.model}`);
    }

    // Resume/fork
    if (options.sessionId && def.resumeFlag) {
      flags.push(`${def.resumeFlag} ${options.sessionId}`);
    } else if (options.parentSessionId && def.resumeFlag) {
      flags.push(`${def.resumeFlag} ${options.parentSessionId}`);
      flags.push("--fork-session");
    }

    // Initial prompt (positional argument)
    if (options.initialPrompt?.trim() && def.initialPromptFlag !== undefined) {
      const prompt = options.initialPrompt.trim();
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      flags.push(`'${escapedPrompt}'`);
    }

    return flags;
  },

};

export const codexProvider: AgentProvider = {
  id: "codex",
  name: "Codex",
  description: "OpenAI's CLI",
  command: "codex",
  configDir: "~/.codex",

  supportsResume: false, // Codex doesn't have explicit resume
  supportsFork: false,

  buildFlags(options: BuildFlagsOptions): string[] {
    const def = getProviderDefinition("codex");
    const flags: string[] = [];

    // Auto-approve flag from registry
    if (
      (options.skipPermissions || options.autoApprove) &&
      def.autoApproveFlag
    ) {
      flags.push(def.autoApproveFlag);
    }

    if (options.model && def.modelFlag) {
      flags.push(`${def.modelFlag} ${options.model}`);
    }

    // Initial prompt (positional argument for Codex)
    if (options.initialPrompt?.trim() && def.initialPromptFlag !== undefined) {
      const prompt = options.initialPrompt.trim();
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      flags.push(`'${escapedPrompt}'`);
    }

    return flags;
  },

};

/**
 * OpenCode Provider
 * Open-source AI coding CLI with multi-provider support
 */
export const opencodeProvider: AgentProvider = {
  id: "opencode",
  name: "OpenCode",
  description: "Multi-provider AI CLI",
  command: "opencode",
  configDir: "~/.opencode.json",

  supportsResume: false, // OpenCode manages sessions internally via SQLite
  supportsFork: false,

  buildFlags(options: BuildFlagsOptions): string[] {
    const def = getProviderDefinition("opencode");
    const flags: string[] = [];

    // OpenCode uses --prompt for non-interactive, but we want interactive mode
    // So we typically don't add flags for interactive use

    if (options.skipPermissions) {
      // OpenCode doesn't have a skip permissions flag
      // It manages this via config
    }

    // Initial prompt (uses --prompt flag)
    if (options.initialPrompt?.trim() && def.initialPromptFlag) {
      const prompt = options.initialPrompt.trim();
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      flags.push(def.initialPromptFlag);
      flags.push(`'${escapedPrompt}'`);
    }

    return flags;
  },

};

/**
 * Shell Provider
 * Plain terminal without any AI CLI
 */
export const shellProvider: AgentProvider = {
  id: "shell",
  name: "Terminal",
  description: "Plain shell terminal",
  command: "", // No command - just shell
  configDir: "",

  supportsResume: false,
  supportsFork: false,

  buildFlags(): string[] {
    return []; // No flags for shell
  },

};

// Provider registry
export const providers: Record<AgentType, AgentProvider> = {
  "claude-a": {
    ...claudeProvider,
    id: "claude-a",
    name: "Claude (a)",
    command: "claude-a",
    configDir: "~/.claude-profiles/a",
  },
  "claude-b": {
    ...claudeProvider,
    id: "claude-b",
    name: "Claude (b)",
    command: "claude-b",
    configDir: "~/.claude-profiles/b",
  },
  "claude-c": {
    ...claudeProvider,
    id: "claude-c",
    name: "Claude (c)",
    command: "claude-c",
    configDir: "~/.claude-profiles/c",
  },
  claude: claudeProvider,
  commandcode: commandcodeProvider,
  codex: codexProvider,
  opencode: opencodeProvider,
  shell: shellProvider,
};

// Get provider by ID
export function getProvider(agentType: AgentType): AgentProvider {
  return providers[agentType] || claudeProvider;
}

// Get all providers as array
export function getAllProviders(): AgentProvider[] {
  return Object.values(providers);
}

// Type guard (use registry)
export function isValidAgentType(value: string): value is AgentType {
  return isValidProviderId(value);
}

// Export registry functions for convenience
export {
  getProviderDefinition,
  getAllProviderDefinitions,
} from "./providers/registry";
