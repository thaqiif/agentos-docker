import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * POST /api/tmux/split - split the attached tmux session's active pane.
 *
 * Splitting is delegated to tmux rather than done in the browser layout.
 * A React-side split only existed in one tab's memory, so it evaporated on
 * refresh; a tmux split is part of the session's own window layout and is
 * still there when you re-attach, from this browser or any other client.
 *
 * `-h` puts the new pane to the right (a vertical divider), `-v` puts it
 * below. tmux names these the opposite way round to most editors, so the
 * request speaks in UI terms and the mapping happens here.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, direction } = await request.json();

    if (!session || typeof session !== "string") {
      return NextResponse.json(
        { error: "session is required" },
        { status: 400 }
      );
    }

    if (direction !== "horizontal" && direction !== "vertical") {
      return NextResponse.json(
        { error: "direction must be 'horizontal' or 'vertical'" },
        { status: 400 }
      );
    }

    // "Split horizontal" in the UI means a horizontal divider: the new pane
    // sits below, which is tmux's -v.
    const flag = direction === "horizontal" ? "-v" : "-h";

    // execFile, not exec: session names reach us from the client and must
    // never be pasted into a shell string.
    await execFileAsync("tmux", [
      "split-window",
      flag,
      "-t",
      session,
      "-c",
      "#{pane_current_path}",
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error splitting tmux pane:", error);
    return NextResponse.json(
      { error: "Failed to split tmux pane" },
      { status: 500 }
    );
  }
}
