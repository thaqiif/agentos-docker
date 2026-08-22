import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-1.5 py-px font-mono text-[10px] font-medium tracking-[0.08em] uppercase transition-colors focus:ring-1 focus:ring-ring focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive",
        outline: "border-border-strong text-foreground",
        success:
          "border-status-running/40 bg-status-running/10 text-status-running",
        warning:
          "border-status-waiting/40 bg-status-waiting/10 text-status-waiting",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
