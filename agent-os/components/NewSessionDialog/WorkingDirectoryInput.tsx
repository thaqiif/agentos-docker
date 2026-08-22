import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2, FolderOpen } from "lucide-react";
import type { GitInfo } from "./NewSessionDialog.types";

interface WorkingDirectoryInputProps {
  value: string;
  onChange: (value: string) => void;
  gitInfo: GitInfo | null;
  checkingGit: boolean;
  onBrowse: () => void;
}

export function WorkingDirectoryInput({
  value,
  onChange,
  gitInfo,
  checkingGit,
  onBrowse,
}: WorkingDirectoryInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="tech-label">03</span>
        <label htmlFor="new-session-working-directory" className="tech-label">
          Working Directory
        </label>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="new-session-working-directory"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="~/projects/my-app"
            className="font-mono text-sm"
          />
          {checkingGit && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onBrowse}
          title="Browse directories"
          aria-label="Browse directories"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
      {gitInfo?.isGitRepo && (
        <p className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-status-running" />
          <span className="text-muted-foreground text-xs">
            Git repo on{" "}
          </span>
          <span className="tech-meta text-foreground">
            {gitInfo.currentBranch}
          </span>
        </p>
      )}
    </div>
  );
}
