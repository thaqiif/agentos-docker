import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarFooter() {
  return (
    <div className="border-sidebar-border mt-auto border-t px-3 pt-2 pb-3">
      <div className="flex items-center justify-between">
        <span className="tech-label">//theme</span>
        <ThemeToggle />
      </div>
      <div className="text-foreground-subtle mt-2 text-center font-mono text-[10px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://aterm.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              aTerm
            </a>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Desktop terminal workspace for AI coding agents</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
