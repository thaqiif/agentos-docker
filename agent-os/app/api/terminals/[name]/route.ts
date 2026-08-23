import { NextRequest, NextResponse } from "next/server";
import { killTerminal, renameTerminal } from "@/lib/terminals";
import {
  forgetTerminal,
  renameTerminalRow,
} from "@/lib/terminal-registry";

/**
 * DELETE /api/terminals/:name - close a terminal for good.
 *
 * Killing the tmux session alone would leave the registry entry behind and
 * the terminal would reappear as restartable. Closing is explicit user
 * intent, so the entry is forgotten too.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decoded = decodeURIComponent(name);

    // The session may already be gone (this is how a stopped terminal is
    // removed); forgetting it is the part that must happen either way.
    await killTerminal(decoded).catch(() => {});
    forgetTerminal(decoded);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error killing terminal:", error);
    return NextResponse.json(
      { error: "Failed to kill terminal" },
      { status: 500 }
    );
  }
}

/** PATCH /api/terminals/:name - rename the tmux session. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const { newName } = await request.json();

    if (!newName || typeof newName !== "string") {
      return NextResponse.json(
        { error: "newName is required" },
        { status: 400 }
      );
    }

    const decoded = decodeURIComponent(name);
    await renameTerminal(decoded, newName).catch(() => {});
    renameTerminalRow(decoded, newName);
    return NextResponse.json({ success: true, name: newName });
  } catch (error) {
    console.error("Error renaming terminal:", error);
    return NextResponse.json(
      { error: "Failed to rename terminal" },
      { status: 500 }
    );
  }
}
