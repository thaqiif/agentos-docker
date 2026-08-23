"use client";

import { Plus, Terminal as TerminalIcon, Command } from "lucide-react";
import type { TerminalRecord } from "@/lib/terminals";
import { cn } from "@/lib/utils";

interface WelcomeProps {
  terminals: TerminalRecord[];
  onNewTerminal: () => void;
  onSelectTerminal: (name: string) => void;
  onQuickSwitch?: () => void;
}

const RECENT_LIMIT = 6;

/**
 * What the workbench shows when it is not attached to anything.
 *
 * Before this, an unattached workbench still rendered a live terminal — a
 * bare shell that looked like a tmux session but was not one, so anything
 * typed into it vanished on refresh. Showing nothing at all is more honest,
 * and gives closing a terminal somewhere to land.
 */
export function Welcome({
  terminals,
  onNewTerminal,
  onSelectTerminal,
  onQuickSwitch,
}: WelcomeProps) {
  // Most recently active first; tmux reports activity in epoch seconds.
  const recent = [...terminals]
    .sort((a, b) => b.activity - a.activity)
    .slice(0, RECENT_LIMIT);

  return (
    <div className="bg-background workbench-grid flex h-full w-full items-center justify-center overflow-auto p-8">
      <div className="w-full max-w-md">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">AgentOS</h1>
          <span className="tech-label">workbench</span>
        </div>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          No terminal attached.
        </p>

        <div className="border-border mt-6 border-t pt-4">
          <span className="tech-label">start</span>
          <div className="mt-2 flex flex-col items-start gap-1">
            <button
              onClick={onNewTerminal}
              className="text-primary hover:text-primary/80 flex items-center gap-2 py-1 text-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New terminal
            </button>
            {onQuickSwitch && (
              <button
                onClick={onQuickSwitch}
                className="text-primary hover:text-primary/80 flex items-center gap-2 py-1 text-sm transition-colors"
              >
                <Command className="h-3.5 w-3.5" />
                Quick switch
                <span className="text-foreground-subtle font-mono text-[10px]">
                  ⌘K
                </span>
              </button>
            )}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="border-border mt-5 border-t pt-4">
            <span className="tech-label">terminals</span>
            <div className="mt-2 flex flex-col items-stretch">
              {recent.map((terminal) => (
                <button
                  key={terminal.id}
                  onClick={() => onSelectTerminal(terminal.tmux_name)}
                  className="hover:bg-accent/50 group flex items-center gap-2 px-1 py-1.5 text-left transition-colors"
                >
                  <TerminalIcon
                    className={cn(
                      "h-3 w-3 shrink-0",
                      terminal.alive
                        ? "text-muted-foreground"
                        : "text-foreground-subtle"
                    )}
                  />
                  <span className="truncate text-sm">{terminal.name}</span>
                  <span className="text-foreground-subtle ml-auto shrink-0 font-mono text-[10px] tracking-[0.1em] uppercase">
                    {terminal.alive ? terminal.agent_type || "shell" : "stopped"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
