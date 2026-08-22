"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Terminal, GitBranch, Check } from "lucide-react";
import type { Session } from "@/lib/db";
import { CodeSearchResults } from "@/components/CodeSearch/CodeSearchResults";
import { useRipgrepAvailable } from "@/data/code-search";

interface QuickSwitcherProps {
  sessions: Session[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSession: (sessionId: string) => void;
  onSelectFile?: (file: string, line: number) => void;
  currentSessionId?: string;
  activeSessionWorkingDir?: string;
}

function ModeCell({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex h-full items-center border-l border-border px-3 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {active && <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />}
    </button>
  );
}

/**
 * Quick session switcher with search
 * Triggered by Cmd+K or button tap
 */
export function QuickSwitcher({
  sessions,
  open,
  onOpenChange,
  onSelectSession,
  onSelectFile,
  currentSessionId,
  activeSessionWorkingDir,
}: QuickSwitcherProps) {
  const [mode, setMode] = useState<"sessions" | "code">("sessions");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if ripgrep is available
  const { data: ripgrepAvailable } = useRipgrepAvailable();

  // Filter sessions based on search query
  const filteredSessions = sessions.filter((session) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      session.name?.toLowerCase().includes(q) ||
      session.working_directory?.toLowerCase().includes(q) ||
      session.agent_type?.toLowerCase().includes(q)
    );
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode("sessions");
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Force sessions mode if ripgrep is not available
  useEffect(() => {
    if (ripgrepAvailable === false && mode === "code") {
      setMode("sessions");
    }
  }, [ripgrepAvailable, mode]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredSessions.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredSessions[selectedIndex]) {
            onSelectSession(filteredSessions[selectedIndex].id);
            onOpenChange(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [filteredSessions, selectedIndex, onSelectSession, onOpenChange]
  );

  // Format relative time
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Handle file selection from code search
  const handleSelectFile = useCallback(
    (file: string, line: number) => {
      onOpenChange(false);
      onSelectFile?.(file, line);
    },
    [onOpenChange, onSelectFile]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden border-border-strong bg-popover p-0 shadow-md sm:max-w-md"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Switch Session / Search Code</DialogTitle>
        </DialogHeader>

        {/* Header strip */}
        <div className="border-border flex h-9 shrink-0 items-center justify-between border-b pl-4">
          <span className="tech-label">//quick switch</span>
          {ripgrepAvailable === true && (
            <div className="flex h-full items-stretch">
              <ModeCell
                label="Sessions"
                active={mode === "sessions"}
                onClick={() => setMode("sessions")}
              />
              <ModeCell
                label="Code"
                active={mode === "code"}
                onClick={() => setMode("code")}
              />
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="border-border flex items-center gap-2.5 border-b px-4">
          <span className="text-primary font-mono text-sm select-none">❯</span>
          <Input
            ref={inputRef}
            placeholder={
              mode === "sessions" || !ripgrepAvailable
                ? "search sessions"
                : "search code (min 3 chars)"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={mode === "sessions" ? handleKeyDown : undefined}
            className="h-11 border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0 md:text-sm"
          />
        </div>

        {/* Content */}
        <div className="scrollbar-thin max-h-[300px] overflow-y-auto">
          {mode === "sessions" ? (
            filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="tech-label">//sessions 000</span>
                <span className="tech-meta">No sessions found</span>
              </div>
            ) : (
              filteredSessions.map((session, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = session.id === currentSessionId;
                const time = formatTime(session.updated_at);
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "relative flex w-full items-center gap-3 py-2 pr-4 pl-3 text-left transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    {isSelected && (
                      <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />
                    )}

                    <span className="w-5 shrink-0 font-mono text-[9px] text-foreground-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {session.worktree_path ? (
                      <GitBranch className="text-muted-foreground h-3 w-3 shrink-0" />
                    ) : (
                      <Terminal className="text-muted-foreground h-3 w-3 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm leading-tight">
                          {session.name || "Unnamed Session"}
                        </span>
                        {isCurrent && (
                          <Check className="text-primary h-3 w-3 shrink-0" />
                        )}
                      </div>
                      <div className="tech-meta mt-1 flex items-center gap-1.5 truncate">
                        <span>{session.agent_type || "claude"}</span>
                        <span className="text-foreground-subtle">·</span>
                        <span className="truncate">
                          {session.working_directory?.split("/").pop() || "~"}
                        </span>
                        {time && (
                          <>
                            <span className="text-foreground-subtle">·</span>
                            <span className="shrink-0">{time}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            <CodeSearchResults
              workingDirectory={activeSessionWorkingDir || "~"}
              query={query}
              onSelectFile={handleSelectFile}
            />
          )}
        </div>

        {/* Footer Hint */}
        <div className="border-border flex items-center justify-between border-t px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.12em] text-foreground-subtle uppercase">
            ↑↓ navigate ↵ open esc close
          </span>
          {mode === "sessions" && (
            <span className="tech-label">
              {String(filteredSessions.length).padStart(2, "0")} sessions
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
