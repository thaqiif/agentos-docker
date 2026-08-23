"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Home,
  ChevronUp,
  Loader2,
  FolderInput,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/lib/file-utils";

interface DirectoryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryPicker({
  open,
  onClose,
  onSelect,
  initialPath = "~",
}: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track home directory path from API
  const [homePath, setHomePath] = useState<string | null>(null);

  // Fetch directory contents
  const fetchDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return { dirs: [], expandedPath: path };
      }
      // Store the home path if we're at ~
      if (path === "~" && data.path) {
        setHomePath(data.path);
      }
      // Filter to only directories
      const dirs = (data.files || []).filter(
        (f: FileNode) => f.type === "directory"
      );
      return { dirs, expandedPath: data.path };
    } catch {
      setError("Failed to load directory");
      return { dirs: [], expandedPath: path };
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial directory
  useEffect(() => {
    if (open) {
      fetchDirectory(currentPath).then(({ dirs }) => setDirectories(dirs));
      setSelectedPath(null);
    }
  }, [open, currentPath, fetchDirectory]);

  // Navigate up to parent
  const goUp = () => {
    // Can't go above root
    if (currentPath === "/") {
      return;
    }

    // From ~ or homePath, go to parent of home directory
    if (currentPath === "~" || (homePath && currentPath === homePath)) {
      if (homePath) {
        const homeParent = homePath.split("/").slice(0, -1).join("/") || "/";
        setCurrentPath(homeParent);
        setExpanded(new Set());
      }
      return;
    }

    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = currentPath.startsWith("~")
      ? "~/" + parts.slice(1).join("/") || "~"
      : "/" + parts.join("/") || "/";
    setCurrentPath(newPath);
    setExpanded(new Set());
  };

  // Go to root
  const goRoot = () => {
    setCurrentPath("/");
    setExpanded(new Set());
  };

  // Go to home
  const goHome = () => {
    setCurrentPath("~");
    setExpanded(new Set());
  };

  // Toggle directory expansion and fetch children
  const toggleExpand = async (node: FileNode) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(node.path)) {
      newExpanded.delete(node.path);
    } else {
      newExpanded.add(node.path);
      // Fetch children if not already loaded
      if (!node.children || node.children.length === 0) {
        const { dirs } = await fetchDirectory(node.path);
        // Update the node with children
        setDirectories((prev) => updateNodeChildren(prev, node.path, dirs));
      }
    }
    setExpanded(newExpanded);
  };

  // Select a directory
  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedPath) {
      // Convert absolute path back to ~ format if it's in home directory
      let finalPath = selectedPath;
      if (homePath && selectedPath.startsWith(homePath)) {
        finalPath = "~" + selectedPath.slice(homePath.length);
      }
      onSelect(finalPath);
      onClose();
    }
  };

  // Select current directory
  const selectCurrentDirectory = () => {
    // Convert to ~ format if in home directory
    let finalPath = currentPath;
    if (homePath && currentPath.startsWith(homePath)) {
      finalPath = "~" + currentPath.slice(homePath.length);
    }
    onSelect(finalPath);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col">
        <DialogHeader>
          <span className="tech-label">dir.select</span>
          <DialogTitle className="font-mono text-sm font-medium tracking-[0.16em] uppercase">
            Select Directory
          </DialogTitle>
        </DialogHeader>

        {/* Navigation bar */}
        <div className="border-border scrollbar-none flex h-8 shrink-0 items-stretch overflow-x-auto border-y">
          <button
            onClick={goRoot}
            title="Root"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-8 shrink-0 items-center justify-center transition-colors"
          >
            <HardDrive className="h-3 w-3" />
          </button>
          <button
            onClick={goHome}
            title="Home"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-8 shrink-0 items-center justify-center border-l transition-colors"
          >
            <Home className="h-3 w-3" />
          </button>
          <button
            onClick={goUp}
            disabled={currentPath === "/"}
            title="Go up"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-8 shrink-0 items-center justify-center border-l transition-colors disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <span className="tech-meta flex min-w-0 items-center truncate px-2">
            {currentPath}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={selectCurrentDirectory}
            title="Select this directory"
            className="ml-auto shrink-0 gap-1 self-center font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            <FolderInput className="h-3 w-3" />
            use this ❯
          </Button>
        </div>

        {/* Directory listing */}
        <div className="scrollbar-thin max-h-[400px] min-h-[200px] flex-1 overflow-y-auto">
          {loading && directories.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
              <span className="tech-label">loading</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <span className="text-destructive tech-label">error</span>
              <p className="tech-meta text-center">{error}</p>
            </div>
          ) : directories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="tech-label">empty</p>
              <p className="tech-meta">no subdirectories</p>
            </div>
          ) : (
            <div className="py-1">
              <DirectoryTree
                nodes={directories}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={toggleExpand}
                onSelect={handleSelect}
                onDoubleClick={(path) => {
                  setCurrentPath(path);
                  setExpanded(new Set());
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPath}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DirectoryTreeProps {
  nodes: FileNode[];
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (node: FileNode) => void;
  onSelect: (path: string) => void;
  onDoubleClick: (path: string) => void;
  depth?: number;
}

function DirectoryTree({
  nodes,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
  onDoubleClick,
  depth = 0,
}: DirectoryTreeProps) {
  return (
    <div className={cn("w-full", depth > 0 && "border-border ml-3 border-l")}>
      {nodes.map((node) => {
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;

        return (
          <div key={node.path}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node.path)}
              onDoubleClick={() => onDoubleClick(node.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(node.path);
                }
              }}
              className={cn(
                "relative flex h-7 w-full cursor-pointer items-center gap-1.5 pr-2 pl-2 text-left transition-colors",
                isSelected ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              {isSelected && (
                <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />
              )}

              {/* Expand/collapse */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(node);
                }}
                className="text-muted-foreground hover:text-foreground flex h-4 w-4 flex-shrink-0 items-center justify-center"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Icon */}
              {isExpanded ? (
                <FolderOpen className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <Folder className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
              )}

              {/* Name */}
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {node.name}
              </span>
            </div>

            {/* Children */}
            {isExpanded && node.children && node.children.length > 0 && (
              <DirectoryTree
                nodes={node.children}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper to update node children in tree
function updateNodeChildren(
  nodes: FileNode[],
  targetPath: string,
  children: FileNode[]
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeChildren(node.children, targetPath, children),
      };
    }
    return node;
  });
}
