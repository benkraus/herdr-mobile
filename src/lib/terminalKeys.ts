import type { HerdrTerminalKey, TerminalSemanticBaseKey } from "./types";

const SEMANTIC_KEY_INPUT: Record<TerminalSemanticBaseKey, string> = {
  esc: "\u001b",
  tab: "\t",
  left: "\u001b[D",
  down: "\u001b[B",
  up: "\u001b[A",
  right: "\u001b[C",
};

export function terminalKeyInputData(key: HerdrTerminalKey): string {
  if (key === "Enter") return "\r";
  if (key === "Tab" || key === "tab") return "\t";
  if (key === "Backspace") return "\u007F";
  if (key === "ctrl+c") return "\u0003";
  if (key === "shift+tab") return "\u001b[Z";

  const semanticInput = SEMANTIC_KEY_INPUT[key as TerminalSemanticBaseKey];
  if (semanticInput !== undefined) return semanticInput;

  const separator = key.indexOf("+");
  const modifier = key.slice(0, separator);
  const baseKey = key.slice(separator + 1) as TerminalSemanticBaseKey;
  const baseInput = SEMANTIC_KEY_INPUT[baseKey];
  return modifier === "alt" ? `\u001b${baseInput}` : baseInput;
}

export function terminalKeyNeedsInputSettle(key: HerdrTerminalKey): boolean {
  return key === "Enter" || key === "Tab";
}
