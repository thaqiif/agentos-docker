import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { SessionStatus } from "@/lib/status-detector";
import type { AgentType } from "@/lib/providers";
import { getDb } from "@/lib/db";
import { statusStream } from "@/lib/status-stream";

const execAsync = promisify(exec);

interface SessionStatusResponse {
  sessionName: string;
  status: SessionStatus;
  lastLine?: string;
  claudeSessionId?: string | null;
  agentType?: AgentType;
}

async function getTmuxSessionCwd(sessionName: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `tmux display-message -t "${sessionName}" -p "#{pane_current_path}" 2>/dev/null || echo ""`
    );
    const cwd = stdout.trim();
    return cwd || null;
  } catch {
    return null;
  }
}

// Get Claude session ID from tmux environment variable
async function getClaudeSessionIdFromEnv(
  sessionName: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `tmux show-environment -t "${sessionName}" CLAUDE_SESSION_ID 2>/dev/null || echo ""`
    );
    const line = stdout.trim();
    if (line.startsWith("CLAUDE_SESSION_ID=")) {
      const sessionId = line.replace("CLAUDE_SESSION_ID=", "");
      if (sessionId && sessionId !== "null") {
        return sessionId;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Get Claude session ID by looking at session files on disk
function getClaudeSessionIdFromFiles(projectPath: string): string | null {
  const home = os.homedir();
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");
  const projectDirName = projectPath.replace(/\//g, "-");
  const projectDir = path.join(claudeDir, "projects", projectDirName);

  if (!fs.existsSync(projectDir)) {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

  try {
    const files = fs.readdirSync(projectDir);
    let mostRecent: string | null = null;
    let mostRecentTime = 0;

    for (const file of files) {
      if (file.startsWith("agent-")) continue;
      if (!uuidPattern.test(file)) continue;

      const filePath = path.join(projectDir, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs > mostRecentTime) {
        mostRecentTime = stat.mtimeMs;
        mostRecent = file.replace(".jsonl", "");
      }
    }

    if (mostRecent && Date.now() - mostRecentTime < 5 * 60 * 1000) {
      return mostRecent;
    }

    const configFile = path.join(claudeDir, ".claude.json");
    if (fs.existsSync(configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
        if (config.projects?.[projectPath]?.lastSessionId) {
          return config.projects[projectPath].lastSessionId;
        }
      } catch {
        // Ignore config parse errors
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function getClaudeSessionId(sessionName: string): Promise<string | null> {
  const envId = await getClaudeSessionIdFromEnv(sessionName);
  if (envId) {
    return envId;
  }

  const cwd = await getTmuxSessionCwd(sessionName);
  if (cwd) {
    return getClaudeSessionIdFromFiles(cwd);
  }

  return null;
}


// Track previous statuses to detect changes
const previousStatuses = new Map<string, SessionStatus>();


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const activeId = url.searchParams.get("active");

    // The session the user is currently viewing counts as seen, so a
    // finished ("done") session settles back to idle once they open it.
    if (activeId) await statusStream.acknowledge(activeId);

    // Same engine the SSE stream uses, so the polling fallback can never
    // disagree with the live stream.
    const snapshot = await statusStream.getSnapshot();

    const db = getDb();
    const statusMap: Record<string, SessionStatusResponse> = {};
    const sessionsToUpdate: string[] = [];

    const entries = Object.entries(snapshot);

    // claude_session_id resolution touches the filesystem, so keep it off
    // the status tick and do it here where a slower response is fine.
    const claudeIds = await Promise.all(
      entries.map(async ([, entry]) => getClaudeSessionId(entry.sessionName))
    );

    entries.forEach(([id, entry], i) => {
      const prevStatus = previousStatuses.get(id);
      if (entry.status === "running" || entry.status === "waiting") {
        if (prevStatus !== entry.status) sessionsToUpdate.push(id);
      }
      previousStatuses.set(id, entry.status);

      statusMap[id] = {
        sessionName: entry.sessionName,
        status: entry.status,
        lastLine: entry.lastLine,
        claudeSessionId: claudeIds[i],
        agentType: entry.agentType as AgentType,
      };
    });

    const updateStatusStmt = db.prepare(
      "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?"
    );
    const updateClaudeIdStmt = db.prepare(
      "UPDATE sessions SET claude_session_id = ? WHERE id = ? AND (claude_session_id IS NULL OR claude_session_id != ?)"
    );

    for (const id of sessionsToUpdate) updateStatusStmt.run(id);

    entries.forEach(([id], i) => {
      const claudeSessionId = claudeIds[i];
      if (claudeSessionId)
        updateClaudeIdStmt.run(claudeSessionId, id, claudeSessionId);
    });

    return NextResponse.json({ statuses: statusMap });
  } catch (error) {
    console.error("Error getting session statuses:", error);
    return NextResponse.json({ statuses: {} });
  }
}
