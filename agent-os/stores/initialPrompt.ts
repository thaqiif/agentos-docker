/**
 * Store for pending initial prompts to be sent when terminal becomes ready
 * Uses a simple Map keyed by terminalId
 */

const pendingPrompts = new Map<string, string>();

export function setPendingPrompt(terminalId: string, prompt: string): void {
  if (prompt.trim()) {
    pendingPrompts.set(terminalId, prompt.trim());
  }
}

export function getPendingPrompt(terminalId: string): string | null {
  return pendingPrompts.get(terminalId) || null;
}

export function clearPendingPrompt(terminalId: string): void {
  pendingPrompts.delete(terminalId);
}

export function hasPendingPrompt(terminalId: string): boolean {
  return pendingPrompts.has(terminalId);
}
