"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Terminal as TerminalIcon, Clock, RefreshCw, Loader2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/db";

interface SessionPreviewPopoverProps {
  session: Session | null;
  status?: "idle" | "running" | "waiting" | "error" | "dead";
  position: { x: number; y: number };
}

interface TerminalSnapshot {
  lines: string[];
  timestamp: number;
}

const statusColors: Record<string, string> = {
  running: "text-status-running bg-status-running/10",
  waiting: "text-status-waiting bg-status-waiting/10 animate-status-pulse",
  idle: "text-muted-foreground bg-muted",
  dead: "text-foreground-subtle bg-accent",
  error: "text-status-error bg-status-error/10",
};

const statusLabels: Record<string, string> = {
  running: "Working",
  waiting: "Waiting",
  idle: "Idle",
  dead: "Dead",
  error: "Error",
};

const REFRESH_INTERVAL = 2000;

export function SessionPreviewPopover({
  session,
  status = "idle",
  position,
}: SessionPreviewPopoverProps) {
  const [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSnapshotRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchPreview = useCallback(
    async (sessionId: string, isRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/sessions/${sessionId}/preview`, {
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          setSnapshot({
            lines: data.lines || [],
            timestamp: Date.now(),
          });
          hasSnapshotRef.current = true;
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.name !== "AbortError" &&
          !hasSnapshotRef.current
        ) {
          // Keep existing snapshot if we have one
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  // Scroll to bottom when snapshot updates
  useEffect(() => {
    if (terminalRef.current && snapshot?.lines.length) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [snapshot]);

  useEffect(() => {
    if (!session) {
      setSnapshot(null);
      hasSnapshotRef.current = false;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      return;
    }

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      fetchPreview(session.id, false);

      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);

      refreshIntervalRef.current = setInterval(() => {
        fetchPreview(session.id, true);
      }, REFRESH_INTERVAL);
    }, 100);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [session, fetchPreview]);

  if (!session) return null;

  const label = statusLabels[status] || status;

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div
      style={{
        position: "fixed",
        left: position.x + 16,
        top: Math.max(
          16,
          Math.min(
            position.y - 200,
            typeof window !== "undefined" ? window.innerHeight - 720 : 400
          )
        ),
        zIndex: 100,
      }}
      className="animate-in fade-in slide-in-from-left-2 pointer-events-none duration-150"
    >
      <div
        className={cn(
          "w-[720px] overflow-hidden rounded-lg",
          "bg-popover",
          "border border-border-strong",
          "shadow-md"
        )}
      >
        {/* Header */}
        <div className="bg-surface border-b border-border px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[280px] truncate text-sm font-medium text-foreground">
                {session.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isRefreshing && (
                <RefreshCw className="text-muted-foreground h-3 w-3 animate-spin" />
              )}
              <span
                className={cn(
                  "px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                  statusColors[status]
                )}
              >
                {label}
              </span>
            </div>
          </div>
          <div className="tech-meta mt-2 flex items-center gap-3">
            {session.branch_name && (
              <span className="flex max-w-[220px] items-center gap-1 truncate">
                <GitBranch className="h-3 w-3" />
                {session.branch_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(session.created_at)}
            </span>
            {session.working_directory && (
              <span className="max-w-[250px] truncate">
                {session.working_directory.split("/").pop()}
              </span>
            )}
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="p-2">
          <div
            ref={terminalRef}
            className={cn(
              "scrollbar-thin h-[480px]",
              "bg-background font-mono text-[13px] leading-relaxed",
              "overflow-auto p-3",
              "border border-border"
            )}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading preview...</span>
                </div>
              </div>
            ) : snapshot?.lines.length ? (
              <div className="space-y-0.5">
                {snapshot.lines.map((line, i) => (
                  <div
                    key={i}
                    className="whitespace-pre text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: parseAnsiToHtml(line),
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                <span>No output yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="bg-surface border-t border-border px-4 py-1.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            ❯ click to connect
          </div>
        </div>
      </div>
    </div>
  );
}

// ANSI to HTML parser for terminal colors
function parseAnsiToHtml(text: string): string {
  const colorMap: Record<string, string> = {
    "0": "",
    "1": "font-weight: bold",
    "2": "opacity: 0.7",
    "3": "font-style: italic",
    "4": "text-decoration: underline",
    "30": "color: #3f3f46",
    "31": "color: #f87171",
    "32": "color: #4ade80",
    "33": "color: #fbbf24",
    "34": "color: #60a5fa",
    "35": "color: #c084fc",
    "36": "color: #22d3ee",
    "37": "color: #e4e4e7",
    "90": "color: #71717a",
    "91": "color: #fca5a5",
    "92": "color: #86efac",
    "93": "color: #fde047",
    "94": "color: #93c5fd",
    "95": "color: #d8b4fe",
    "96": "color: #67e8f9",
    "97": "color: #fafafa",
  };

  let result = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const codeList = codes.split(";");

    if (codeList.includes("0")) {
      return "</span>";
    }

    const styles: string[] = [];
    for (const code of codeList) {
      if (colorMap[code]) {
        styles.push(colorMap[code]);
      }
    }

    if (styles.length > 0) {
      return `<span style="${styles.join("; ")}">`;
    }
    return "";
  });

  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1b\[0m/g, "</span>");

  return result;
}
