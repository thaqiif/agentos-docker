import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { TerminalRecord } from "@/lib/terminals";
import type { SessionStatus } from "@/components/views/types";
import { statusKeys } from "../terminals/keys";

interface StatusResponse {
  statuses: Record<string, SessionStatus>;
}

async function fetchStatuses(
  activeTerminal?: string | null
): Promise<StatusResponse> {
  const url = activeTerminal
    ? `/api/terminals/status?active=${encodeURIComponent(activeTerminal)}`
    : "/api/terminals/status";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch statuses");
  return res.json();
}

interface UseTerminalStatusesOptions {
  terminals: TerminalRecord[];
  activeTerminal?: string | null;
  checkStateChanges: (
    states: Array<{
      id: string;
      name: string;
      status: SessionStatus["status"];
    }>,
    activeTerminal?: string | null
  ) => void;
}

/**
 * Live terminal statuses, keyed by tmux session name.
 *
 * Primary transport is SSE (`/api/terminals/status/stream`), which pushes a
 * new snapshot within ~1s of anything changing. React Query still owns the
 * cache so every consumer reads one source, and its polling stays available
 * as a fallback for when the stream cannot connect.
 */
export function useTerminalStatusesQuery({
  terminals,
  activeTerminal,
  checkStateChanges,
}: UseTerminalStatusesOptions) {
  const queryClient = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const streamConnectedRef = useRef(false);

  useEffect(() => {
    streamConnectedRef.current = streamConnected;
  }, [streamConnected]);

  // ── SSE transport ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined")
      return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let disposed = false;

    const queryKey = [...statusKeys.all, activeTerminal ?? null];

    const connect = () => {
      if (disposed) return;

      const url = activeTerminal
        ? `/api/terminals/status/stream?active=${encodeURIComponent(activeTerminal)}`
        : "/api/terminals/status/stream";

      source = new EventSource(url);

      source.addEventListener("statuses", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          attempts = 0;
          if (!streamConnectedRef.current) setStreamConnected(true);
          queryClient.setQueryData(queryKey, payload);
        } catch {
          // Ignore a malformed frame; the next one supersedes it.
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;
        setStreamConnected(false);
        if (disposed) return;

        // Back off, but stay responsive: 1s, 2s, 4s, capped at 10s.
        const delay = Math.min(1000 * 2 ** attempts, 10000);
        attempts += 1;
        retry = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      source?.close();
      setStreamConnected(false);
    };
  }, [activeTerminal, queryClient]);

  // ── Polling fallback ───────────────────────────────────────────────────
  // Disabled while the stream is healthy; takes over the moment it is not.
  const query = useQuery({
    queryKey: [...statusKeys.all, activeTerminal ?? null],
    queryFn: () => fetchStatuses(activeTerminal),
    placeholderData: (prev) => prev,
    staleTime: 2000,
    refetchInterval: streamConnected ? false : 3000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!query.data?.statuses) return;

    const statuses = query.data.statuses;

    const terminalStates = terminals.map((t) => ({
      id: t.id,
      name: t.name,
      status: (statuses[t.id]?.status || "dead") as SessionStatus["status"],
    }));
    checkStateChanges(terminalStates, activeTerminal);
  }, [query.data, terminals, activeTerminal, checkStateChanges]);

  return {
    terminalStatuses: query.data?.statuses ?? {},
    isLoading: query.isLoading && !query.data,
  };
}
