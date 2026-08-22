"use client";

import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, GitBranch, FolderPlus, Check } from "lucide-react";
import type { AgentType } from "@/lib/providers";
import { getModelOptions } from "@/lib/model-catalog";
import { AGENT_OPTIONS, CLONE_STEP } from "./NewProjectDialog.types";
import type { NewProjectDialogProps } from "./NewProjectDialog.types";
import { useNewProjectForm } from "./hooks/useNewProjectForm";
import { DevServersSection } from "./DevServersSection";
import { DirectoryField } from "./DirectoryField";
import {
  CreatingOverlay,
  type StepConfig,
} from "@/components/NewSessionDialog/CreatingOverlay";

const cloneSteps: StepConfig[] = [
  { id: CLONE_STEP.CLONING, label: "Cloning repository", icon: GitBranch },
  { id: CLONE_STEP.CREATING, label: "Creating project", icon: FolderPlus },
  { id: CLONE_STEP.DONE, label: "Done", icon: Check },
];

export function NewProjectDialog({
  open,
  mode = "new",
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const form = useNewProjectForm(mode, onClose, onCreated);
  const modelOptions = getModelOptions(form.agentType);
  const selectedModelLabel =
    modelOptions.find((option) => option.value === form.defaultModel)?.label ||
    "Select a model";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && form.handleClose()}>
      <DialogContent className="scrollbar-thin max-h-[90vh] max-w-lg gap-0 overflow-y-auto p-0">
        {form.isCloning && (
          <CreatingOverlay
            isWorktree={false}
            step={form.cloneStep}
            steps={cloneSteps}
            hint="This may take a moment depending on the repository size"
          />
        )}
        <DialogHeader className="border-b border-border px-6 py-4">
          <span className="tech-label">
            {form.isCloneMode ? "//project.clone" : "//project.new"}
          </span>
          <DialogTitle className="font-mono text-sm font-medium tracking-[0.16em] uppercase">
            {form.isCloneMode ? "Clone from GitHub" : "New Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit}>
          <div className="divide-y divide-border px-6">
            {form.isCloneMode && (
              <div className="space-y-2 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">01</span>
                  <label htmlFor="new-project-github-url" className="tech-label">
                    Repository URL
                  </label>
                </div>
                <div className="relative">
                  <Input
                    id="new-project-github-url"
                    value={form.githubUrl}
                    onChange={(e) => form.handleGithubUrlChange(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="font-mono text-sm"
                    autoFocus
                  />
                  <Link className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                </div>
              </div>
            )}

            <div className="space-y-2 py-4">
              <div className="flex items-baseline gap-2">
                <span className="tech-label">
                  {form.isCloneMode ? "02" : "01"}
                </span>
                <label htmlFor="new-project-name" className="tech-label">
                  Project Name
                </label>
                {form.isCloneMode && (
                  <span className="tech-label">(optional, derived from URL)</span>
                )}
              </div>
              <Input
                id="new-project-name"
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                placeholder={
                  form.isCloneMode
                    ? "auto-detected from URL"
                    : "my-awesome-project"
                }
                className="font-mono text-sm"
                autoFocus={!form.isCloneMode}
              />
            </div>

            <div className="py-4">
              <DirectoryField
                label={form.isCloneMode ? "Clone Into" : "Working Directory"}
                value={form.workingDirectory}
                onChange={form.setWorkingDirectory}
                checkingDir={form.checkingDir}
                isGitRepo={form.isGitRepo}
                recentDirs={form.recentDirs}
              />
            </div>

            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2">
                <span className="tech-label">
                  {form.isCloneMode ? "03" : "02"}
                </span>
                <label htmlFor="new-project-agent" className="tech-label">
                  Default Agent
                </label>
              </div>
              <Select
                value={form.agentType}
                onValueChange={(v) => form.handleAgentTypeChange(v as AgentType)}
              >
                <SelectTrigger id="new-project-agent" className="font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="scrollbar-thin">
                  {AGENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-mono text-xs">{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2">
                <span className="tech-label">
                  {form.isCloneMode ? "04" : "03"}
                </span>
                <label htmlFor="new-project-model" className="tech-label">
                  Default Model
                </label>
              </div>
              <Select
                key={form.agentType}
                value={form.defaultModel}
                onValueChange={form.setDefaultModel}
              >
                <SelectTrigger id="new-project-model" className="font-mono text-sm">
                  <SelectValue>{selectedModelLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent className="scrollbar-thin">
                  {modelOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-mono text-xs">{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!form.isCloneMode && (
              <div className="py-4">
                <DevServersSection
                  devServers={form.devServers}
                  isDetecting={form.isDetecting}
                  workingDirectory={form.workingDirectory}
                  onDetect={form.detectDevServers}
                  onAdd={form.addDevServer}
                  onRemove={form.removeDevServer}
                  onUpdate={form.updateDevServer}
                />
              </div>
            )}

            {form.error && (
              <p className="flex items-center gap-2 pt-3 pb-4 font-mono text-xs text-status-error">
                <span className="h-1.5 w-1.5 shrink-0 animate-status-pulse bg-status-error" />
                {form.error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={form.handleClose}
              className="font-mono text-[10px] tracking-[0.12em] uppercase"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.isPending || form.isCloning}
              className="font-mono text-[10px] tracking-[0.12em] uppercase"
            >
              {form.isCloning
                ? "Cloning..."
                : form.isPending
                  ? "Creating..."
                  : form.isCloneMode
                    ? "Clone & Create"
                    : "Create Project"}
              {!form.isCloning && !form.isPending && (
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
