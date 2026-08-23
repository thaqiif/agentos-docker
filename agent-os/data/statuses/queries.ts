import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/db";
import type { SessionStatus } from "@/components/views/types";
import { statusKeys } from "../sessions/keys";

interface StatusResponse {
  statuses: Record<string, SessionStatus>;
}

async function fetchStatuses(
  activeSessionId?: string | null
): Promise<StatusResponse> {
  const url = activeSessionId
    ? `/api/sessions/status?active=${encodeURIComponent(activeSessionId)}`
    : "/api/sessions/status";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch statuses");
  return res.json();
}

interface UseSessionStatusesOptions {
  sessions: Session[];
  activeSessionId?: string | null;
  checkStateChanges: (
    states: Array<{
      id: string;
      name: string;
      status: SessionStatus["status"];
    }>,
    activeSessionId?: string | null
  ) => void;
}

/**
 * Live session statuses.
 *
 * Primary transport is SSE (`/api/sessions/status/stream`), which pushes a
 * new snapshot within ~1s of anything changing. React Query still owns the
 * cache so every consumer reads one source, and its polling stays available
 * as a fallback for when the stream cannot connect.
 */
export function useSessionStatusesQuery({
  sessions,
  activeSessionId,
  checkStateChanges,
}: UseSessionStatusesOptions) {
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

    const queryKey = [...statusKeys.all, activeSessionId ?? null];

    const connect = () => {
      if (disposed) return;

      const url = activeSessionId
        ? `/api/sessions/status/stream?active=${encodeURIComponent(activeSessionId)}`
        : "/api/sessions/status/stream";

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
  }, [activeSessionId, queryClient]);

  // ── Polling fallback ───────────────────────────────────────────────────
  // Disabled while the stream is healthy; takes over the moment it is not.
  const query = useQuery({
    queryKey: [...statusKeys.all, activeSessionId ?? null],
    queryFn: () => fetchStatuses(activeSessionId),
    placeholderData: (prev) => prev,
    staleTime: 2000,
    refetchInterval: streamConnected ? false : 3000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!query.data?.statuses) return;

    const statuses = query.data.statuses;

    const sessionStates = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      status: (statuses[s.id]?.status || "dead") as SessionStatus["status"],
    }));
    checkStateChanges(sessionStates, activeSessionId);
    // Note: claude_session_id is now updated server-side in /api/sessions/status
  }, [query.data, sessions, activeSessionId, checkStateChanges]);

  return {
    sessionStatuses: query.data?.statuses ?? {},
    isLoading: query.isLoading && !query.data,
  };
}
