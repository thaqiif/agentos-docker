"use client";

import { useState, useEffect, useRef } from "react";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServerLogsModalProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function ServerLogsModal({
  serverId,
  serverName,
  onClose,
}: ServerLogsModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/dev-servers/${serverId}/logs?lines=200`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [serverId]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [serverId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={cn(
          "flex h-[80vh] w-full max-w-3xl flex-col",
          "bg-background border-border border"
        )}
      >
        {/* Header */}
        <div className="border-border flex h-11 shrink-0 items-stretch justify-between border-b">
          <div className="flex min-w-0 items-center gap-2.5 px-4">
            <span className="tech-label">logs</span>
            <h2 className="truncate font-mono text-sm font-medium tracking-[0.08em] uppercase">
              {serverName}
            </h2>
          </div>
          <div className="flex items-stretch">
            <button
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              title="Refresh"
              className={cn(
                "text-muted-foreground hover:bg-accent hover:text-foreground flex w-8 items-center justify-center border-l border-border transition-colors",
                "disabled:pointer-events-none disabled:opacity-30"
              )}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-8 items-center justify-center border-l border-border transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Log terminal */}
        <div
          ref={logsRef}
          className={cn(
            "scrollbar-thin flex-1 overflow-auto p-3",
            "bg-background font-mono text-xs leading-relaxed"
          )}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              <span className="tech-meta ml-2">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="tech-label flex h-full items-center justify-center">
              no output
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "break-all whitespace-pre-wrap",
                    line.includes("error") || line.includes("Error")
                      ? "text-status-error"
                      : line.includes("warn") || line.includes("Warning")
                        ? "text-status-waiting"
                        : "text-muted-foreground"
                  )}
                >
                  {line || " "}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border text-muted-foreground flex shrink-0 items-center justify-between border-t px-4 py-1.5">
          <span className="tech-meta">auto-refresh 3s</span>
          {refreshing && (
            <RefreshCw className="text-muted-foreground inline h-3 w-3 animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}
