"use client";

import { useState, useEffect } from "react";
import { X, Server, Container, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectDevServer } from "@/lib/db";

interface DetectedServer {
  type: "node" | "docker";
  name: string;
  command: string;
  ports: number[];
}

interface StartServerDialogProps {
  project: Project;
  projectDevServers?: ProjectDevServer[];
  onStart: (opts: {
    projectId: string;
    type: "node" | "docker";
    name: string;
    command: string;
    workingDirectory: string;
    ports?: number[];
  }) => Promise<void>;
  onClose: () => void;
}

export function StartServerDialog({
  project,
  projectDevServers = [],
  onStart,
  onClose,
}: StartServerDialogProps) {
  const [detected, setDetected] = useState<DetectedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom server form state
  const [showCustom, setShowCustom] = useState(false);
  const [customType, setCustomType] = useState<"node" | "docker">("node");
  const [customName, setCustomName] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [customPort, setCustomPort] = useState("3000");

  // Detect available servers
  useEffect(() => {
    async function detect() {
      try {
        const res = await fetch(
          `/api/dev-servers/detect?projectId=${project.id}`
        );
        if (res.ok) {
          const data = await res.json();
          setDetected(data.servers || []);
        }
      } catch (err) {
        console.error("Failed to detect servers:", err);
      } finally {
        setLoading(false);
      }
    }
    detect();
  }, [project.id]);

  const handleStartProjectServer = async (server: ProjectDevServer) => {
    setStarting(true);
    setError(null);
    try {
      await onStart({
        projectId: project.id,
        type: server.type,
        name: server.name,
        command: server.command,
        workingDirectory: project.working_directory,
        ports: server.port ? [server.port] : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start server");
    } finally {
      setStarting(false);
    }
  };

  const handleStartDetected = async (server: DetectedServer) => {
    setStarting(true);
    setError(null);
    try {
      await onStart({
        projectId: project.id,
        type: server.type,
        name: server.name,
        command: server.command,
        workingDirectory: project.working_directory,
        ports: server.ports,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start server");
    } finally {
      setStarting(false);
    }
  };

  const handleStartCustom = async () => {
    if (!customName || !customCommand) {
      setError("Name and command are required");
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const port = parseInt(customPort, 10);
      await onStart({
        projectId: project.id,
        type: customType,
        name: customName,
        command: customCommand,
        workingDirectory: project.working_directory,
        ports: isNaN(port) ? undefined : [port],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start server");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={cn(
          "flex max-h-[90vh] w-full max-w-md flex-col",
          "bg-background border-border border"
        )}
      >
        {/* Header */}
        <div className="border-border flex h-11 shrink-0 items-stretch justify-between border-b">
          <div className="flex min-w-0 items-center gap-2.5 px-4">
            <span className="tech-label">dev servers.start</span>
            <h2 className="truncate font-mono text-sm font-medium tracking-[0.08em] uppercase">
              Start Dev Server
            </h2>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-8 shrink-0 items-center justify-center border-l border-border transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="divide-border scrollbar-thin min-h-0 flex-1 divide-y overflow-y-auto">
          {/* Target */}
          <div className="flex items-baseline gap-2 px-4 py-3">
            <span className="tech-label">target</span>
            <span className="truncate text-sm font-medium">
              {project.name}
            </span>
            <span className="tech-meta ml-auto hidden truncate sm:block">
              {project.working_directory}
            </span>
          </div>

          {/* Registered servers */}
          {projectDevServers.length > 0 && (
            <div>
              <p className="tech-label px-4 pt-3">registered</p>
              <div className="mt-1 pb-2">
                {projectDevServers.map((server, i) => (
                  <button
                    key={server.id}
                    onClick={() => handleStartProjectServer(server)}
                    disabled={starting}
                    className={cn(
                      "hover:bg-accent/30 group flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono text-[9px] text-foreground-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {server.type === "docker" ? (
                      <Container className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Server className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {server.name}
                      </span>
                      <span className="tech-meta block truncate">
                        $ {server.command}
                        {server.port && ` · ${server.port}`}
                      </span>
                    </span>
                    <Play className="text-primary h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Detected servers */}
          <div>
            <p className="tech-label px-4 pt-3">detected</p>
            <div className="mt-1 pb-2">
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                  <span className="tech-meta">scanning for dev servers</span>
                </div>
              ) : detected.length > 0 ? (
                detected.map((server, i) => (
                  <button
                    key={i}
                    onClick={() => handleStartDetected(server)}
                    disabled={starting}
                    className={cn(
                      "hover:bg-accent/30 flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono text-[9px] text-foreground-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {server.type === "docker" ? (
                      <Container className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Server className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {server.name}
                      </span>
                      <span className="tech-meta block truncate">
                        $ {server.command}
                        {server.ports.length > 0 && ` · ${server.ports[0]}`}
                      </span>
                    </span>
                    <Play className="text-primary h-3.5 w-3.5 shrink-0" />
                  </button>
                ))
              ) : (
                <p className="tech-meta px-4 py-3">
                  No dev servers detected automatically
                </p>
              )}
            </div>
          </div>

          {/* Custom form */}
          {!showCustom ? (
            <div className="px-4 py-3">
              <button
                onClick={() => setShowCustom(true)}
                disabled={starting}
                className="text-primary hover:text-primary/80 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              >
                <Play className="h-3 w-3" />
                Add custom server
              </button>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div className="flex items-stretch">
                <button
                  onClick={() => setCustomType("node")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 border py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    customType === "node"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Server className="h-3 w-3" />
                  Node.js
                </button>
                <button
                  onClick={() => setCustomType("docker")}
                  className={cn(
                    "-ml-px flex flex-1 items-center justify-center gap-2 border py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    customType === "docker"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Container className="h-3 w-3" />
                  Docker
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">01</span>
                  <label htmlFor="custom-server-name" className="tech-label">
                    Name
                  </label>
                </div>
                <input
                  id="custom-server-name"
                  type="text"
                  placeholder="Server name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className={cn(
                    "border-border placeholder:text-muted-foreground/60 focus:border-primary w-full border bg-transparent px-2.5 py-2 text-sm outline-none transition-colors"
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">02</span>
                  <label htmlFor="custom-server-command" className="tech-label">
                    Command
                  </label>
                </div>
                <input
                  id="custom-server-command"
                  type="text"
                  placeholder={
                    customType === "docker"
                      ? "Service name (e.g., web)"
                      : "Command (e.g., npm run dev)"
                  }
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  className={cn(
                    "border-border placeholder:text-muted-foreground/60 focus:border-primary w-full border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors"
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">03</span>
                  <label className="tech-label">Directory</label>
                  <span className="tech-label">(fixed)</span>
                </div>
                <p className="tech-meta truncate border-border border bg-transparent px-2.5 py-2">
                  {project.working_directory}
                </p>
              </div>

              {customType === "node" && (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="tech-label">04</span>
                    <label htmlFor="custom-server-port" className="tech-label">
                      Port
                    </label>
                    <span className="tech-label">(optional)</span>
                  </div>
                  <input
                    id="custom-server-port"
                    type="text"
                    placeholder="Port (optional)"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    className={cn(
                      "border-border placeholder:text-muted-foreground/60 focus:border-primary w-full border bg-transparent px-2.5 py-2 font-mono text-xs outline-none transition-colors"
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="flex items-center gap-2 px-4 py-3 font-mono text-xs text-status-error">
              <span className="bg-status-error animate-status-pulse h-1.5 w-1.5 shrink-0 rounded-full" />
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            disabled={starting}
            className="border-border text-muted-foreground hover:border-border-strong hover:text-foreground flex h-7 items-center gap-1.5 border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          {showCustom ? (
            <button
              onClick={handleStartCustom}
              disabled={starting || !customName || !customCommand}
              className="bg-primary text-primary-foreground hover:bg-primary/85 flex h-7 items-center gap-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              {starting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Starting
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Start
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
