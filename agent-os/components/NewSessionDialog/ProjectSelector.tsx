import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowRight } from "lucide-react";
import type { ProjectWithDevServers } from "@/lib/projects";
import type { AgentType } from "@/lib/providers";

interface ProjectSelectorProps {
  projects: ProjectWithDevServers[];
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  workingDirectory: string;
  agentType: AgentType;
  showNewProject: boolean;
  onShowNewProjectChange: (show: boolean) => void;
  newProjectName: string;
  onNewProjectNameChange: (name: string) => void;
  creatingProject: boolean;
  onCreateProject: () => void;
  canCreateProject: boolean;
}

export function ProjectSelector({
  projects,
  projectId,
  onProjectChange,
  workingDirectory,
  agentType,
  showNewProject,
  onShowNewProjectChange,
  newProjectName,
  onNewProjectNameChange,
  creatingProject,
  onCreateProject,
  canCreateProject,
}: ProjectSelectorProps) {
  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="tech-label">04</span>
        <label className="tech-label" htmlFor="new-session-project">
          Project
        </label>
      </div>
      {showNewProject ? (
        <div className="flex gap-2">
          <Input
            id="new-session-project"
            value={newProjectName}
            onChange={(e) => onNewProjectNameChange(e.target.value)}
            placeholder="Project name"
            className="font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCreateProject();
              } else if (e.key === "Escape") {
                onShowNewProjectChange(false);
                onNewProjectNameChange("");
              }
            }}
            disabled={creatingProject}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCreateProject}
            disabled={
              !newProjectName.trim() ||
              creatingProject ||
              !workingDirectory ||
              workingDirectory === "~"
            }
            className="font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            {creatingProject ? "Creating..." : "Create"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onShowNewProjectChange(false);
              onNewProjectNameChange("");
            }}
            disabled={creatingProject}
            className="font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select
            value={projectId || "none"}
            onValueChange={(v) => onProjectChange(v === "none" ? null : v)}
          >
            <SelectTrigger className="flex-1 font-mono text-sm">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent className="scrollbar-thin">
              <SelectItem value="none">
                <span className="text-muted-foreground">
                  No project (uncategorized)
                </span>
              </SelectItem>
              {projects
                .filter((p) => !p.is_uncategorized)
                .map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="font-mono text-xs">{project.name}</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {canCreateProject && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onShowNewProjectChange(true)}
              title="Create new project"
              aria-label="Create new project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {showNewProject && (
        <p className="tech-meta flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
          {workingDirectory && workingDirectory !== "~"
            ? `New project will use: ${workingDirectory}, ${agentType}`
            : "Enter a working directory above to create a project"}
        </p>
      )}
      {!showNewProject &&
        selectedProject &&
        !selectedProject.is_uncategorized && (
          <p className="tech-meta">
            Settings inherited: {selectedProject.working_directory},{" "}
            {selectedProject.agent_type}
          </p>
        )}
    </div>
  );
}
