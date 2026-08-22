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
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/components/FolderPicker";
import { useHomePath } from "@/hooks/useHomePath";

import { useNewSessionForm } from "./hooks/useNewSessionForm";
import { AgentSelector } from "./AgentSelector";
import { WorkingDirectoryInput } from "./WorkingDirectoryInput";
import { WorktreeSection } from "./WorktreeSection";
import { ProjectSelector } from "./ProjectSelector";
import { AdvancedSettings } from "./AdvancedSettings";
import { CreatingOverlay } from "./CreatingOverlay";
import type { NewSessionDialogProps } from "./NewSessionDialog.types";

export function NewSessionDialog({
  open,
  projects,
  selectedProjectId,
  onClose,
  onCreated,
  onCreateProject,
}: NewSessionDialogProps) {
  const { toTildePath } = useHomePath();
  const form = useNewSessionForm({
    open,
    projects,
    selectedProjectId,
    onCreated,
    onClose,
    onCreateProject,
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && !form.isLoading && form.handleClose()}
      >
        <DialogContent
          className="scrollbar-thin max-h-[85vh] gap-0 overflow-y-auto p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey && !form.isLoading) {
              e.preventDefault();
              form.handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        >
          {form.isLoading && (
            <CreatingOverlay
              isWorktree={form.useWorktree}
              step={form.creationStep}
            />
          )}
          <DialogHeader className="border-b border-border px-6 py-4">
            <span className="tech-label">//session.new</span>
            <DialogTitle className="font-mono text-sm font-medium tracking-[0.16em] uppercase">
              New Session
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit}>
            <div className="divide-y divide-border px-6">
              <div className="py-4 first:pt-4">
                <AgentSelector
                  value={form.agentType}
                  onChange={form.handleAgentTypeChange}
                />
              </div>

              <div className="space-y-2 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">02</span>
                  <label htmlFor="new-session-name" className="tech-label">
                    Name
                  </label>
                  <span className="tech-label">(optional)</span>
                </div>
                <Input
                  id="new-session-name"
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>

              <div className="py-4">
                <WorkingDirectoryInput
                  value={form.workingDirectory}
                  onChange={form.setWorkingDirectory}
                  gitInfo={form.gitInfo}
                  checkingGit={form.checkingGit}
                  onBrowse={() => form.setShowDirectoryPicker(true)}
                />

                {form.gitInfo?.isGitRepo && (
                  <div className="mt-4">
                    <WorktreeSection
                      gitInfo={form.gitInfo}
                      useWorktree={form.useWorktree}
                      onUseWorktreeChange={form.setUseWorktree}
                      featureName={form.featureName}
                      onFeatureNameChange={form.setFeatureName}
                      baseBranch={form.baseBranch}
                      onBaseBranchChange={form.setBaseBranch}
                    />
                  </div>
                )}
              </div>

              <div className="py-4">
                <ProjectSelector
                  projects={projects}
                  projectId={form.projectId}
                  onProjectChange={form.handleProjectChange}
                  workingDirectory={form.workingDirectory}
                  agentType={form.agentType}
                  showNewProject={form.showNewProject}
                  onShowNewProjectChange={form.setShowNewProject}
                  newProjectName={form.newProjectName}
                  onNewProjectNameChange={form.setNewProjectName}
                  creatingProject={form.creatingProject}
                  onCreateProject={form.handleCreateProject}
                  canCreateProject={!!onCreateProject}
                />
              </div>

              <div className="space-y-2 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="tech-label">05</span>
                  <label htmlFor="initialPrompt" className="tech-label">
                    Initial Prompt
                  </label>
                  <span className="tech-label">(optional)</span>
                </div>
                <Textarea
                  id="initialPrompt"
                  value={form.initialPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    form.setInitialPrompt(e.target.value)
                  }
                  placeholder="Enter a prompt to send when the session starts..."
                  className="min-h-[80px] resize-none text-sm"
                  rows={3}
                />
              </div>

              <div className="py-1">
                <AdvancedSettings
                  open={form.advancedOpen}
                  onOpenChange={form.setAdvancedOpen}
                  agentType={form.agentType}
                  useTmux={form.useTmux}
                  onUseTmuxChange={form.handleUseTmuxChange}
                  skipPermissions={form.skipPermissions}
                  onSkipPermissionsChange={form.handleSkipPermissionsChange}
                />
              </div>

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
                disabled={form.isLoading}
                className="font-mono text-[10px] tracking-[0.12em] uppercase"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.isLoading ||
                  (form.useWorktree && !form.featureName.trim())
                }
                className="font-mono text-[10px] tracking-[0.12em] uppercase"
              >
                {form.isLoading ? "Creating..." : "Create"}
                {!form.isLoading && (
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {form.showDirectoryPicker && (
        <FolderPicker
          initialPath={form.workingDirectory || "~"}
          onSelect={(path) => {
            form.setWorkingDirectory(toTildePath(path));
            form.setShowDirectoryPicker(false);
          }}
          onClose={() => form.setShowDirectoryPicker(false)}
        />
      )}
    </>
  );
}
