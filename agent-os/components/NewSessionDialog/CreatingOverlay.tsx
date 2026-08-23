"use client";

import type { LucideIcon } from "lucide-react";
import { GitBranch, Package, FileCode, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface CreatingOverlayProps {
  isWorktree: boolean;
  step: string;
  /** Override default steps and hint text */
  steps?: StepConfig[];
  hint?: string;
}

const worktreeSteps: StepConfig[] = [
  { id: "worktree", label: "Creating worktree", icon: GitBranch },
  { id: "setup", label: "Setting up environment", icon: Package },
  { id: "done", label: "Finalizing", icon: FileCode },
];

export function CreatingOverlay({
  isWorktree,
  step,
  steps,
  hint,
}: CreatingOverlayProps) {
  const resolvedSteps = steps ?? (isWorktree ? worktreeSteps : null);

  if (!resolvedSteps) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background/95 backdrop-blur-sm">
        <p className="font-mono text-xs tracking-[0.16em] uppercase text-muted-foreground">
          creating session
        </p>
        <p className="text-primary animate-caret-blink font-mono text-sm">
          INITIALIZING_
        </p>
      </div>
    );
  }

  const currentIndex = resolvedSteps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-1">
        <span className="tech-label">session.create</span>
        <p className="text-primary animate-caret-blink font-mono text-sm tracking-[0.12em]">
          INITIALIZING_
        </p>
      </div>
      <div className="w-full max-w-xs space-y-0 divide-y divide-border border-y border-border">
        {resolvedSteps.map((s, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 px-1 py-2 font-mono text-xs transition-colors",
                isComplete && "text-muted-foreground",
                isCurrent && "text-foreground",
                !isComplete && !isCurrent && "text-foreground-subtle/50"
              )}
            >
              <span className="tech-label w-6 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 uppercase tracking-[0.08em]">
                {s.label}
              </span>
              {isComplete ? (
                <Check className="h-3 w-3 shrink-0 text-status-running" />
              ) : isCurrent ? (
                <span className="h-2 w-2 shrink-0 animate-status-pulse bg-primary" />
              ) : (
                <span className="size-2 shrink-0 border border-border-strong" />
              )}
            </div>
          );
        })}
      </div>
      <p className="tech-meta">
        {hint ?? "This may take a minute for large codebases"}
      </p>
    </div>
  );
}
