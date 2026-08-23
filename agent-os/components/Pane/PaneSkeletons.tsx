"use client";

import { ShimmeringLoader } from "@/components/ui/skeleton";
import { FolderOpen, GitBranch } from "lucide-react";

export function TerminalSkeleton() {
  return (
    <div className="bg-background workbench-grid flex h-full w-full flex-col items-center justify-center gap-3">
      <span className="tech-label">terminal</span>
      <div className="flex items-center gap-2">
        <div className="bg-primary animate-status-pulse h-1.5 w-1.5" />
        <span className="text-muted-foreground font-mono text-xs tracking-[0.08em]">
          CONNECTING
        </span>
        <span className="bg-muted-foreground animate-caret-blink h-3 w-1.5" />
      </div>
    </div>
  );
}

export function FileExplorerSkeleton() {
  return (
    <div className="bg-background h-full w-full p-4">
      <div className="mb-4 flex items-center gap-2">
        <FolderOpen className="text-muted-foreground/50 h-4 w-4" />
        <ShimmeringLoader className="h-4 w-32" />
      </div>
      <div className="space-y-2 pl-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <ShimmeringLoader className="h-4 w-4" delayIndex={i} />
            <ShimmeringLoader className="h-4 w-24" delayIndex={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GitPanelSkeleton() {
  return (
    <div className="bg-background h-full w-full p-4">
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="text-muted-foreground/50 h-4 w-4" />
        <ShimmeringLoader className="h-4 w-24" />
      </div>
      <div className="space-y-3">
        <ShimmeringLoader className="h-8 w-full rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <ShimmeringLoader className="h-4 w-4" delayIndex={i} />
              <ShimmeringLoader className="h-4 flex-1" delayIndex={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
