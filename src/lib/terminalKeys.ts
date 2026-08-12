import type { TerminalKey } from "./types";

export function terminalKeyInputData(key: TerminalKey): "\r" | "\t" | "\u007F" {
  if (key === "Enter") return "\r";
  if (key === "Tab") return "\t";
  return "\u007F";
}

export function terminalKeyNeedsInputSettle(key: TerminalKey): boolean {
  return key === "Enter" || key === "Tab";
}
