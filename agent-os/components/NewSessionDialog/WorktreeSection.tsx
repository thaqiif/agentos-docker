import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GitInfo } from "./NewSessionDialog.types";

interface WorktreeSectionProps {
  gitInfo: GitInfo;
  useWorktree: boolean;
  onUseWorktreeChange: (checked: boolean) => void;
  featureName: string;
  onFeatureNameChange: (value: string) => void;
  baseBranch: string;
  onBaseBranchChange: (value: string) => void;
}

export function WorktreeSection({
  gitInfo,
  useWorktree,
  onUseWorktreeChange,
  featureName,
  onFeatureNameChange,
  baseBranch,
  onBaseBranchChange,
}: WorktreeSectionProps) {
  if (!gitInfo.isGitRepo) return null;

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="tech-label">//worktree</span>
          <label
            htmlFor="useWorktree"
            className="cursor-pointer text-sm text-foreground"
          >
            Create isolated worktree
          </label>
        </div>
        <Switch
          id="useWorktree"
          checked={useWorktree}
          onCheckedChange={onUseWorktreeChange}
        />
      </div>

      {useWorktree && (
        <div className="mt-3 space-y-3 border-l border-border pl-4">
          <div className="space-y-1.5">
            <label
              htmlFor="worktree-feature-name"
              className="tech-label block"
            >
              Feature Name
            </label>
            <Input
              id="worktree-feature-name"
              value={featureName}
              onChange={(e) => onFeatureNameChange(e.target.value)}
              placeholder="add-dark-mode"
              className="h-8 font-mono text-sm"
            />
            {featureName && (
              <p className="tech-meta">
                branch: feature/
                {featureName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 50)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="tech-label block">Base Branch</label>
            <Select value={baseBranch} onValueChange={onBaseBranchChange}>
              <SelectTrigger className="h-8 font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="scrollbar-thin">
                {gitInfo.branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    <span className="font-mono text-xs">{branch}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
