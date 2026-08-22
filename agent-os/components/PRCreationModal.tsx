"use client";

import { useState, useEffect } from "react";
import {
  X,
  GitPullRequest,
  Loader2,
  ExternalLink,
  GitBranch,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PRData {
  branch: string;
  baseBranch: string;
  existingPR: {
    number: number;
    url: string;
    state: string;
    title: string;
  } | null;
  commits: { hash: string; subject: string }[];
  suggestedTitle: string;
  suggestedBody: string;
}

interface PRCreationModalProps {
  workingDirectory: string;
  onClose: () => void;
  onSuccess?: (prUrl: string) => void;
}

export function PRCreationModal({
  workingDirectory,
  onClose,
  onSuccess,
}: PRCreationModalProps) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prData, setPrData] = useState<PRData | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Fetch PR data on mount
  useEffect(() => {
    const fetchPRData = async () => {
      try {
        const res = await fetch(
          `/api/git/pr?path=${encodeURIComponent(workingDirectory)}`
        );
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else {
          setPrData(data);
          setTitle(data.suggestedTitle);
          setBody(data.suggestedBody);
        }
      } catch {
        setError("Failed to fetch PR data");
      } finally {
        setLoading(false);
      }
    };

    fetchPRData();
  }, [workingDirectory]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/git/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: workingDirectory,
          title: title.trim(),
          description: body,
          baseBranch: prData?.baseBranch,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.pr?.url) {
        onSuccess?.(data.pr.url);
        // Open PR in new tab
        window.open(data.pr.url, "_blank");
        onClose();
      }
    } catch {
      setError("Failed to create PR");
    } finally {
      setCreating(false);
    }
  };

  // Show existing PR
  if (prData?.existingPR) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex flex-col">
        <Header onClose={onClose} />

        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <GitPullRequest className="text-primary mb-2 h-6 w-6" />
          <p className="tech-label">//pr.exists_</p>
          <p className="tech-meta text-center">
            #{prData.existingPR.number} — {prData.existingPR.title}
          </p>
          <Button
            variant="default"
            onClick={() => window.open(prData.existingPR!.url, "_blank")}
            className="mt-3 min-h-[44px] font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            View Pull Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col">
      <Header onClose={onClose} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : error && !prData ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <p className="tech-label text-status-error">//pr.error</p>
          <p className="text-status-error tech-meta">{error}</p>
          <Button
            variant="outline"
            onClick={onClose}
            className="font-mono text-[10px] tracking-[0.12em] uppercase"
          >
            Close
          </Button>
        </div>
      ) : (
        <>
          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
            {/* 01 Branch info */}
            <section className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0">
                  01
                </span>
                <span className="tech-label">branch</span>
              </div>
              <div className="tech-meta flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5" />
                <span>{prData?.branch}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{prData?.baseBranch}</span>
              </div>
            </section>

            {/* 02 Title input */}
            <section className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0">
                  02
                </span>
                <label className="tech-label">title</label>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PR title..."
                className={
                  "border-input bg-background w-full rounded-none border px-3 py-2 text-sm " +
                  "focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-1 focus-visible:outline-none " +
                  "placeholder:text-muted-foreground/50 min-h-[44px]"
                }
              />
            </section>

            {/* 03 Body textarea */}
            <section className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0">
                  03
                </span>
                <label className="tech-label">description</label>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your changes..."
                rows={12}
                className={
                  "border-input bg-background w-full resize-none rounded-none border px-3 py-2 font-mono text-xs " +
                  "focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-1 focus-visible:outline-none " +
                  "placeholder:text-muted-foreground/50"
                }
              />
            </section>

            {/* 04 Commits list */}
            {prData && prData.commits.length > 0 && (
              <section className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0">
                    04
                  </span>
                  <span className="tech-label">
                    commits {String(prData.commits.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="divide-border divide-y">
                  {prData.commits.slice(0, 10).map((commit) => (
                    <div key={commit.hash} className="py-1.5 text-xs">
                      <code className="text-primary/80 mr-2 font-mono text-[10px]">
                        {commit.hash.slice(0, 7)}
                      </code>
                      <span className="text-muted-foreground">
                        {commit.subject}
                      </span>
                    </div>
                  ))}
                  {prData.commits.length > 10 && (
                    <div className="tech-meta py-1.5">
                      +{prData.commits.length - 10} more commits
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Error message */}
            {error && (
              <p className="text-status-error tech-meta">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="bg-surface border-border safe-area-bottom border-t p-4">
            <Button
              variant="default"
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="min-h-[44px] w-full font-mono text-[10px] tracking-[0.12em] uppercase"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create PR
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-surface border-border flex h-10 shrink-0 items-stretch justify-between border-b">
      <button
        onClick={onClose}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-8 shrink-0 items-center justify-center border-r border-border transition-colors"
        title="Back"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center px-3">
        <span className="tech-label">//pr.create</span>
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-8 shrink-0 items-center justify-center border-l border-border transition-colors md:hidden"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
