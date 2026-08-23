import { statusStream, type StatusSnapshot } from "@/lib/status-stream";

export const dynamic = "force-dynamic";
// Node runtime: the detector shells out to tmux.
export const runtime = "nodejs";

/**
 * GET /api/sessions/status/stream
 *
 * Server-sent stream of session status snapshots. Replaces the old 5–30s
 * poll, which was why a session that started working could take half a
 * minute (or a manual refresh) to show up as running.
 *
 * `?active=<sessionId>` marks the session the user is looking at as seen,
 * so "done" clears the moment they open it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const activeId = url.searchParams.get("active");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const onSnapshot = (snapshot: StatusSnapshot) => {
        send("statuses", { statuses: snapshot });
      };

      if (activeId) await statusStream.acknowledge(activeId);

      const unsubscribe = statusStream.subscribe(onSnapshot);

      // Prime the client even if nothing has changed yet.
      send("statuses", { statuses: await statusStream.getSnapshot() });

      // Comment frames keep intermediaries from timing the stream out.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15000);
      heartbeat.unref?.();

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx and friends) so frames arrive live.
      "X-Accel-Buffering": "no",
    },
  });
}
