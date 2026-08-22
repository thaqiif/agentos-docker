"use client";

import { useState, useEffect } from "react";
import {
  X,
  Folder,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Home,
  Check,
  GitBranch,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDirectoryBrowser } from "@/hooks/useDirectoryBrowser";

const DIRS_ONLY = (f: { type: string }) => f.type === "directory";

interface FolderPickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: FolderPickerProps) {
  const {
    currentPath,
    filteredFiles,
    loading,
    error,
    search,
    setSearch,
    pathSegments,
    navigateTo,
    navigateUp,
    navigateHome,
  } = useDirectoryBrowser({ initialPath, filter: DIRS_ONLY });

  // Git repo check for current directory
  const [isGitRepo, setIsGitRepo] = useState(false);

  useEffect(() => {
    fetch("/api/git/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath }),
    })
      .then((res) => res.json())
      .then((data) => setIsGitRepo(data.isGitRepo || false))
      .catch(() => setIsGitRepo(false));
  }, [currentPath]);

  const folderName = pathSegments[pathSegments.length - 1] || "root";

  return (
    <div className="bg-background fixed inset-0 z-[100] flex flex-col">
      {/* Header */}
      <div className="border-border bg-surface flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <button
          onClick={onClose}
          aria-label="Close picker"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex h-full w-8 shrink-0 items-center justify-center transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
        <span className="tech-label">//folder.select</span>
        <span className="tech-meta ml-auto min-w-0 truncate">
          {currentPath}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search folders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
      </div>

      {/* Navigation bar */}
      <div className="border-border scrollbar-none flex h-8 shrink-0 items-stretch overflow-x-auto border-y">
        <button
          onClick={navigateHome}
          title="Home"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-8 shrink-0 items-center justify-center border-r transition-colors"
        >
          <Home className="h-3 w-3" />
        </button>
        <button
          onClick={navigateUp}
          title="Go up"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-8 shrink-0 items-center justify-center border-r transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <div className="tech-meta flex min-w-0 items-center gap-0.5 px-2">
          <span className="text-foreground-subtle">/</span>
          {pathSegments.map((segment, i) => (
            <button
              key={i}
              onClick={() =>
                navigateTo("/" + pathSegments.slice(0, i + 1).join("/"))
              }
              className="hover:text-foreground flex shrink-0 items-center transition-colors"
            >
              <span className="max-w-[100px] truncate">{segment}</span>
              {i < pathSegments.length - 1 && (
                <ChevronRight className="mx-0.5 h-3 w-3 opacity-50" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center gap-2">
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
            <span className="tech-label">loading</span>
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 p-4">
            <span className="text-destructive tech-label">//error</span>
            <p className="tech-meta text-center">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={navigateUp}
              className="font-mono text-[10px] tracking-[0.12em] uppercase"
            >
              ❯ go back
            </Button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2">
            <p className="tech-label">//empty</p>
            <p className="tech-meta">
              {search ? "no matching folders" : "no subfolders"}
            </p>
          </div>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {filteredFiles.map((node) => (
              <button
                key={node.path}
                onClick={() => navigateTo(node.path)}
                className="hover:bg-accent/50 flex h-8 w-full items-center gap-2 px-3 text-left transition-colors"
              >
                <Folder className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {node.name}
                </span>
                <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer with select button */}
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-t p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Folder className="text-primary h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-mono text-xs text-foreground">
            {folderName}
          </span>
          {isGitRepo && (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase">
              <GitBranch className="h-3 w-3" />
              git
            </span>
          )}
        </div>
        <Button
          onClick={() => onSelect(currentPath)}
          size="sm"
          className={cn("shrink-0 gap-2 font-mono text-[10px] tracking-[0.12em] uppercase")}
        >
          <Check className="h-3 w-3" />
          select ❯
        </Button>
      </div>
    </div>
  );
}
