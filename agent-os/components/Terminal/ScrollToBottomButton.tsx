"use client";

import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({
  visible,
  onClick,
}: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute right-6 bottom-6",
        "flex h-8 w-8 items-center justify-center",
        "border-border-strong bg-surface text-muted-foreground border",
        "hover:bg-accent/50 hover:text-foreground",
        "transition-colors animate-bounce"
      )}
      title="Scroll to bottom"
    >
      <ArrowDown className="h-3.5 w-3.5" />
    </button>
  );
}
