"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Folder,
  FileIcon,
  FileImage,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Home,
  Upload,
  Clipboard,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadFileToTemp } from "@/lib/file-upload";
import { useFileDrop } from "@/hooks/useFileDrop";
import { useViewport } from "@/hooks/useViewport";
import { useDirectoryBrowser } from "@/hooks/useDirectoryBrowser";
import type { FileNode } from "@/lib/file-utils";

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
];

interface FilePickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

function isImageFile(node: FileNode) {
  if (node.type !== "file") return false;
  const ext = node.extension?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

export function FilePicker({
  initialPath,
  onSelect,
  onClose,
}: FilePickerProps) {
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
  } = useDirectoryBrowser({ initialPath });

  const [uploading, setUploading] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useViewport();

  // Handle dropped/pasted/selected file
  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const path = await uploadFileToTemp(file);
        if (path) {
          onSelect(path);
        }
      } catch (err) {
        console.error("Failed to upload file:", err);
      } finally {
        setUploading(false);
      }
    },
    [onSelect]
  );

  // Drag and drop (desktop only)
  const { isDragging, dragHandlers } = useFileDrop(dropZoneRef, handleFile, {
    disabled: uploading || isMobile,
  });

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            break;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  const handleItemClick = (node: FileNode) => {
    if (node.type === "directory") {
      navigateTo(node.path);
    } else if (node.type === "file") {
      onSelect(node.path);
    }
  };

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col">
      {/* Header */}
      <div className="border-border bg-surface flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <button
          onClick={onClose}
          aria-label="Close picker"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 flex h-full w-8 shrink-0 items-center justify-center transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
        <span className="tech-label">//file.select</span>
        <span className="tech-meta ml-auto min-w-0 truncate">
          {currentPath}
        </span>
      </div>

      {/* Navigation bar */}
      <div className="border-border scrollbar-none flex h-8 shrink-0 items-stretch overflow-x-auto border-b">
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

      {/* Upload zone */}
      {isMobile ? (
        <div className="flex items-center justify-center gap-2 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {uploading ? "uploading" : "upload ❯"}
          </Button>
          <span className="tech-meta">or select a file below</span>
        </div>
      ) : (
        <div
          ref={dropZoneRef}
          {...dragHandlers}
          className={cn(
            "border-border mx-3 mt-2 flex flex-col items-center justify-center gap-1 border border-dashed p-3 transition-colors",
            isDragging && "border-primary bg-primary/10",
            uploading && "opacity-50"
          )}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
              <span className="tech-label">uploading</span>
            </div>
          ) : isDragging ? (
            <span className="text-primary font-mono text-[10px] tracking-[0.12em] uppercase">
              ❯ drop file here
            </span>
          ) : (
            <>
              <div className="tech-meta flex items-center gap-2">
                <Upload className="h-3 w-3" />
                <span>drop file here</span>
              </div>
              <div className="text-foreground-subtle flex items-center gap-1 font-mono text-[10px]">
                <Clipboard className="h-3 w-3" />
                <span>or paste from clipboard</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 font-mono text-xs"
          />
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
              {search ? "no matching files" : "empty directory"}
            </p>
          </div>
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {filteredFiles.map((node) => {
              const isImg = isImageFile(node);
              const isDir = node.type === "directory";

              return (
                <button
                  key={node.path}
                  onClick={() => handleItemClick(node)}
                  className={cn(
                    "hover:bg-accent/50 flex h-8 w-full items-center gap-2 px-3 text-left transition-colors"
                  )}
                >
                  {isDir ? (
                    <Folder className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  ) : isImg ? (
                    <FileImage className="text-muted-foreground h-3.5 w-3.5 shrink-0 opacity-70" />
                  ) : node.extension ? (
                    <FileIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0 opacity-70" />
                  ) : (
                    <span className="text-muted-foreground w-3.5 shrink-0 text-center font-mono text-[9px]">
                      ?
                    </span>
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-mono text-xs",
                      isDir ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {node.name}
                  </span>
                  {!isDir && node.extension && (
                    <span className="shrink-0 font-mono text-[9px] tracking-wider text-foreground-subtle uppercase">
                      {node.extension}
                    </span>
                  )}
                  {isDir && (
                    <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-border shrink-0 border-t px-3 py-2 text-center">
        <p className="tech-meta">select any file or navigate into folders</p>
      </div>
    </div>
  );
}
