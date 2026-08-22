"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkerCard, type WorkerInfo } from "./WorkerCard";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkersSummary {
  total: number;
  pending: number;
  running: number;
  waiting: number;
  completed: number;
  failed: number;
}

interface ConductorPanelProps {
  conductorSessionId: string;
  onAttachToWorker?: (workerId: string) => void;
}

export function ConductorPanel({
  conductorSessionId,
  onAttachToWorker,
}: ConductorPanelProps) {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [summary, setSummary] = useState<WorkersSummary | null>(null);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(
    new Set()
  );
  const [workerOutputs, setWorkerOutputs] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orchestrate/workers?conductorId=${conductorSessionId}`
      );
      const data = await res.json();
      if (data.workers) {
        setWorkers(data.workers);
      }
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    }
  }, [conductorSessionId]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orchestrate/workers?conductorId=${conductorSessionId}&summary=true`
      );
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    }
  }, [conductorSessionId]);

  const fetchWorkerOutput = useCallback(async (workerId: string) => {
    try {
      const res = await fetch(`/api/orchestrate/workers/${workerId}?lines=30`);
      const data = await res.json();
      if (data.output) {
        setWorkerOutputs((prev) => ({ ...prev, [workerId]: data.output }));
      }
    } catch (error) {
      console.error("Failed to fetch worker output:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWorkers(), fetchSummary()]);
    setRefreshing(false);
  }, [fetchWorkers, fetchSummary]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchWorkers(), fetchSummary()]);
      setLoading(false);
    };
    load();
  }, [fetchWorkers, fetchSummary]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Fetch output for expanded workers
  useEffect(() => {
    expandedWorkers.forEach((workerId) => {
      if (!workerOutputs[workerId]) {
        fetchWorkerOutput(workerId);
      }
    });
  }, [expandedWorkers, workerOutputs, fetchWorkerOutput]);

  const toggleExpand = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
        // Fetch output when expanding
        fetchWorkerOutput(workerId);
      }
      return next;
    });
  };

  const handleSendMessage = async (workerId: string, message: string) => {
    try {
      await fetch(`/api/orchestrate/workers/${workerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", message }),
      });
      // Refresh output after sending
      setTimeout(() => fetchWorkerOutput(workerId), 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKillWorker = async (workerId: string) => {
    if (!confirm("Kill this worker?")) return;
    try {
      await fetch(`/api/orchestrate/workers/${workerId}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (error) {
      console.error("Failed to kill worker:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="tech-label">//workers 000</p>
        <p className="text-sm text-muted-foreground">No workers spawned.</p>
        <p className="tech-meta max-w-md text-center">
          Use the MCP tools or API to spawn parallel worker sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Command header */}
      <div className="border-border flex h-10 shrink-0 items-center justify-between border-b pr-1 pl-3">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <span className="tech-label">//workers</span>
          <span className="font-mono text-xs text-foreground">
            {String(summary?.total || workers.length).padStart(2, "0")}
          </span>
          {summary && (
            <div className="hidden items-center gap-3 md:flex">
              {summary.running > 0 && (
                <span className="text-status-running flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {summary.running} running
                </span>
              )}
              {summary.waiting > 0 && (
                <span className="text-status-waiting flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                  <span className="h-1.5 w-1.5 animate-status-pulse rounded-full border border-current" />
                  {summary.waiting} waiting
                </span>
              )}
              {summary.completed > 0 && (
                <span className="text-status-running flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full border border-current" />
                  {summary.completed} done
                </span>
              )}
              {summary.failed > 0 && (
                <span className="text-status-error flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase">
                  <span aria-hidden="true">×</span>
                  {summary.failed} failed
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          title="Refresh"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Workers ledger */}
      <div className="scrollbar-thin divide-border flex-1 divide-y overflow-auto">
        {workers.map((worker, i) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            index={i}
            isExpanded={expandedWorkers.has(worker.id)}
            output={workerOutputs[worker.id]}
            onToggleExpand={() => toggleExpand(worker.id)}
            onViewOutput={() => {
              toggleExpand(worker.id);
              fetchWorkerOutput(worker.id);
            }}
            onSendMessage={(msg) => handleSendMessage(worker.id, msg)}
            onKill={() => handleKillWorker(worker.id)}
            onAttach={
              onAttachToWorker ? () => onAttachToWorker(worker.id) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
