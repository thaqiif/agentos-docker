import { NextRequest, NextResponse } from "next/server";
import { listTerminals, createTerminal, toRecord } from "@/lib/terminals";
import { getAllProjects } from "@/lib/projects";
import { resolveProjectForPath } from "@/lib/terminal-projects";

/**
 * GET /api/terminals - every tmux session, with its harness and project.
 *
 * tmux is the source of truth: a session started from a plain shell shows
 * up here exactly like one started from the UI, and one killed outside the
 * UI disappears without anything needing to be reconciled.
 */
export async function GET() {
  try {
    const terminals = await listTerminals();
    const projects = getAllProjects();

    return NextResponse.json(
      terminals.map((terminal) =>
        toRecord(terminal, resolveProjectForPath(terminal.path, projects))
      )
    );
  } catch (error) {
    console.error("Error listing terminals:", error);
    return NextResponse.json(
      { error: "Failed to list terminals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/terminals - open a new terminal.
 *
 * Takes a working directory and nothing else. Which harness to run is the
 * user's call, made by typing its name once the shell is up.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { cwd, projectId } = body as { cwd?: string; projectId?: string };

    let workingDirectory = cwd;

    if (!workingDirectory && projectId) {
      const project = getAllProjects().find((p) => p.id === projectId);
      workingDirectory = project?.working_directory;
    }

    if (!workingDirectory) {
      workingDirectory = process.env.HOME || "/";
    }

    const terminal = await createTerminal(workingDirectory);
    const projects = getAllProjects();

    return NextResponse.json(
      toRecord(terminal, resolveProjectForPath(terminal.path, projects))
    );
  } catch (error) {
    console.error("Error creating terminal:", error);
    return NextResponse.json(
      { error: "Failed to create terminal" },
      { status: 500 }
    );
  }
}
