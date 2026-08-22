import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-lg border bg-transparent px-3 py-2 text-base transition-[color,border-color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/60",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        "min-h-[80px] resize-y",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
