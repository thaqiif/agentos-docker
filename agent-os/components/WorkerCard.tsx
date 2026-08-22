"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  Eye,
  Send,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type WorkerStatus =
  | "pending"
  | "running"
  | "waiting"
  | "idle"
  | "completed"
  | "failed"
  | "dead";

export interface WorkerInfo {
  id: string;
  name: string;
  task: string;
  status: WorkerStatus;
  worktreePath: string | null;
  branchName: string | null;
  createdAt: string;
}

interface WorkerCardProps {
  worker: WorkerInfo;
  index?: number;
  isExpanded?: boolean;
  output?: string;
  onToggleExpand?: () => void;
  onViewOutput?: () => void;
  onSendMessage?: (message: string) => void;
  onKill?: () => void;
  onAttach?: () => void;
}

const statusConfig: Record<
  WorkerStatus,
  { glyph: "dot" | "pulse" | "cross" | "hollow"; color: string; label: string }
> = {
  pending: { glyph: "hollow", color: "text-muted-foreground", label: "Pending" },
  running: { glyph: "dot", color: "text-status-running", label: "Running" },
  waiting: { glyph: "pulse", color: "text-status-waiting", label: "Waiting" },
  idle: { glyph: "hollow", color: "text-muted-foreground", label: "Idle" },
  completed: {
    glyph: "hollow",
    color: "text-status-running",
    label: "Completed",
  },
  failed: { glyph: "cross", color: "text-status-error", label: "Failed" },
  dead: { glyph: "cross", color: "text-status-error", label: "Dead" },
};

function StatusGlyph({
  glyph,
  color,
}: {
  glyph: "dot" | "pulse" | "cross" | "hollow";
  color: string;
}) {
  if (glyph === "cross") {
    return <X className={cn("h-3 w-3 shrink-0 stroke-[3]", color)} />;
  }
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        glyph === "dot" && "bg-current",
        glyph === "pulse" && "animate-status-pulse border border-current",
        glyph === "hollow" && "border border-current",
        color
      )}
    />
  );
}

function formatDuration(from: string): string | null {
  const ms = Date.now() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${String(hours % 24).padStart(2, "0")}h`;
}

export function WorkerCard({
  worker,
  index,
  isExpanded = false,
  output,
  onToggleExpand,
  onViewOutput,
  onSendMessage,
  onKill,
  onAttach,
}: WorkerCardProps) {
  const [message, setMessage] = useState("");
  const [showSendInput, setShowSendInput] = useState(false);

  const config = statusConfig[worker.status];
  const isActive = worker.status === "running" || worker.status === "waiting";
  const duration = formatDuration(worker.createdAt);

  const handleSend = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message.trim());
      setMessage("");
      setShowSendInput(false);
    }
  };

  return (
    <div className={cn("relative transition-colors", isActive && "bg-surface-raised/60")}>
      {isActive && (
        <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />
      )}

      {/* Process row */}
      <div
        className="hover:bg-accent/30 flex cursor-pointer items-center gap-2 py-2 pl-3 pr-2"
        onClick={onToggleExpand}
      >
        <span className="w-4 shrink-0 font-mono text-[9px] text-foreground-subtle">
          {typeof index === "number"
            ? String(index + 1).padStart(2, "0")
            : "--"}
        </span>

        <button className="p-0.5">
          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-3 w-3" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3 w-3" />
          )}
        </button>

        <StatusGlyph glyph={config.glyph} color={config.color} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{worker.name}</span>
            <span
              className={cn(
                "font-mono text-[9px] tracking-[0.14em] uppercase",
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
          {(worker.branchName || duration) && (
            <div className="tech-meta mt-0.5 flex items-center gap-2.5">
              {worker.branchName && (
                <span className="flex min-w-0 items-center gap-1">
                  <GitBranch className="h-3 w-3 shrink-0" />
                  <span className="truncate">{worker.branchName}</span>
                </span>
              )}
              {duration && <span className="shrink-0">up {duration}</span>}
            </div>
          )}
        </div>

        {/* Utility actions */}
        <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
          {isActive && onAttach && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAttach}
                  title="Attach to terminal"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
                >
                  <Eye className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Attach to terminal</TooltipContent>
            </Tooltip>
          )}
          {isActive && onKill && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onKill}
                  title="Kill worker"
                  className="text-muted-foreground hover:text-status-error flex h-6 w-6 items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Kill worker</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Expanded ledger */}
      {isExpanded && (
        <div className="border-border space-y-3 border-t pr-3 pb-3 pt-2 pl-[52px]">
          {/* Task */}
          <div>
            <div className="tech-label mb-1">Task</div>
            <div className="bg-surface font-mono text-xs">{worker.task}</div>
          </div>

          {/* Output preview */}
          {output && (
            <div>
              <div className="tech-label mb-1">Recent output</div>
              <pre className="scrollbar-thin bg-surface max-h-32 overflow-x-auto overflow-y-auto p-2 font-mono text-xs whitespace-pre-wrap">
                {output.slice(-500)}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-0.5">
            {onViewOutput && (
              <button
                onClick={onViewOutput}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              >
                <Eye className="h-3 w-3" />
                Full output
              </button>
            )}

            {isActive && onSendMessage && !showSendInput && (
              <button
                onClick={() => setShowSendInput(true)}
                className="text-muted-foreground hover:text-primary flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              >
                <Send className="h-3 w-3" />
                Send input
              </button>
            )}
          </div>

          {/* Send input form */}
          {showSendInput && (
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                  if (e.key === "Escape") setShowSendInput(false);
                }}
                placeholder="Type message..."
                className="focus:border-primary placeholder:text-muted-foreground/60 border-border bg-background flex-1 border px-2 py-1 font-mono text-xs outline-none transition-colors"
                autoFocus
              />
              <button
                onClick={handleSend}
                className="text-primary hover:text-primary/80 flex items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              >
                Send
              </button>
              <button
                onClick={() => setShowSendInput(false)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
