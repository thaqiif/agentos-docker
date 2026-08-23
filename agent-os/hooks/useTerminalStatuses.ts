import type { TerminalRecord } from "@/lib/terminals";
import type { SessionStatus } from "@/components/views/types";
import { useTerminalStatusesQuery } from "@/data/statuses";

interface UseTerminalStatusesOptions {
  terminals: TerminalRecord[];
  activeTerminal?: string | null;
  checkStateChanges: (
    states: Array<{
      id: string;
      name: string;
      status: SessionStatus["status"];
    }>,
    activeTerminal?: string | null
  ) => void;
}

export function useTerminalStatuses({
  terminals,
  activeTerminal,
  checkStateChanges,
}: UseTerminalStatusesOptions) {
  const { terminalStatuses } = useTerminalStatusesQuery({
    terminals,
    activeTerminal,
    checkStateChanges,
  });

  return { terminalStatuses };
}
