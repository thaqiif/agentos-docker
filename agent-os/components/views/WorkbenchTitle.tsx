"use client";

import { useEffect, useRef, useState } from "react";

interface WorkbenchTitleProps {
  name: string;
  onRename: (name: string, newName: string) => void | Promise<void>;
}

/**
 * The attached terminal's name, renamable in place.
 *
 * Double-click is the quick path; the sidebar's menu still offers the same
 * thing for anyone looking for it.
 */
export function WorkbenchTitle({ name, onRename }: WorkbenchTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Guards against Enter and the follow-up blur both committing. */
  const committedRef = useRef(false);

  useEffect(() => {
    if (!isEditing) return;
    committedRef.current = false;
    setDraft(name);

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditing, name]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;

    const next = draft.trim();
    if (next && next !== name) void onRename(name, next);
    setIsEditing(false);
  };

  const cancel = () => {
    committedRef.current = true;
    setDraft(name);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="border-primary min-w-0 max-w-56 flex-1 border-b bg-transparent text-sm font-medium outline-none"
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to rename"
      className="cursor-text truncate text-sm font-medium"
    >
      {name}
    </span>
  );
}
