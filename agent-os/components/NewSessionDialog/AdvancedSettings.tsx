import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { AgentType } from "@/lib/providers";
import { getProviderDefinition } from "@/lib/providers";

interface AdvancedSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentType: AgentType;
  useTmux: boolean;
  onUseTmuxChange: (checked: boolean) => void;
  skipPermissions: boolean;
  onSkipPermissionsChange: (checked: boolean) => void;
}

export function AdvancedSettings({
  open,
  onOpenChange,
  agentType,
  useTmux,
  onUseTmuxChange,
  skipPermissions,
  onSkipPermissionsChange,
}: AdvancedSettingsProps) {
  const provider = getProviderDefinition(agentType);
  const supportsAutoApprove = Boolean(provider.autoApproveFlag);

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 py-2.5 text-left transition-colors outline-none focus-visible:text-foreground"
      >
        <ChevronRight
          className={`text-muted-foreground h-3.5 w-3.5 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="tech-label">Advanced Settings</span>
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border pt-0 pb-1">
          <div className="flex items-center justify-between gap-3 py-3">
            <label htmlFor="useTmux" className="cursor-pointer text-sm">
              Use tmux session
              <span className="text-muted-foreground ml-1 text-xs">
                (enables detach/attach)
              </span>
            </label>
            <Switch
              id="useTmux"
              checked={useTmux}
              onCheckedChange={onUseTmuxChange}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <label
              htmlFor="skipPermissions"
              className={
                supportsAutoApprove
                  ? "cursor-pointer text-sm"
                  : "cursor-not-allowed text-sm opacity-50"
              }
            >
              Auto-approve tool calls
              <span className="text-muted-foreground ml-1 font-mono text-xs">
                {supportsAutoApprove
                  ? `(${provider.autoApproveFlag})`
                  : "(not supported)"}
              </span>
            </label>
            <Switch
              id="skipPermissions"
              checked={skipPermissions}
              disabled={!supportsAutoApprove}
              onCheckedChange={onSkipPermissionsChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
