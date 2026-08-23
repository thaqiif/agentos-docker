import { NextResponse } from "next/server";
import type { SessionStatus } from "@/lib/status-detector";
import type { AgentType } from "@/lib/providers";
import { statusStream } from "@/lib/status-stream";

interface TerminalStatusResponse {
  sessionName: string;
  status: SessionStatus;
  lastLine?: string;
  agentType?: AgentType;
}

/**
 * GET /api/terminals/status - polling fallback for the SSE stream.
 *
 * Backed by the same ticker the stream uses, so the two can never disagree.
 * Nothing is written to a database here any more: a terminal's state lives
 * in tmux and is re-derived on every tick.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const active = url.searchParams.get("active");

    // The terminal the user is looking at counts as seen, so a finished
    // ("done") terminal settles back to idle once they open it.
    if (active) await statusStream.acknowledge(active);

    const snapshot = await statusStream.getSnapshot();
    const statuses: Record<string, TerminalStatusResponse> = {};

    for (const [name, entry] of Object.entries(snapshot)) {
      statuses[name] = {
        sessionName: entry.sessionName,
        status: entry.status,
        lastLine: entry.lastLine,
        agentType: entry.agentType as AgentType,
      };
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Error getting terminal statuses:", error);
    return NextResponse.json({ statuses: {} });
  }
}
