import type { AgentView, TerminalSubmitKey } from "../../lib/types";

export function terminalSubmitKeyForAgent(
  agent: Pick<AgentView, "agent" | "status">,
): TerminalSubmitKey {
  const isCodex = agent.agent.trim().toLowerCase() === "codex";
  return isCodex && agent.status === "working" ? "Tab" : "Enter";
}
