import { NextRequest, NextResponse } from "next/server";
import { killTerminal, renameTerminal } from "@/lib/terminals";

/** DELETE /api/terminals/:name - kill the tmux session. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    await killTerminal(decodeURIComponent(name));
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

    await renameTerminal(decodeURIComponent(name), newName);
    return NextResponse.json({ success: true, name: newName });
  } catch (error) {
    console.error("Error renaming terminal:", error);
    return NextResponse.json(
      { error: "Failed to rename terminal" },
      { status: 500 }
    );
  }
}
