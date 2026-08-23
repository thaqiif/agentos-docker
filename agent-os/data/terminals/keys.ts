export const terminalKeys = {
  all: ["terminals"] as const,
  list: () => [...terminalKeys.all, "list"] as const,
};

export const statusKeys = {
  all: ["terminal-statuses"] as const,
};
