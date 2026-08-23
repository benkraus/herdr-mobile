import type { TerminalSemanticBaseKey, TerminalSemanticKey } from "../../lib/types";

export type TerminalModifier = "ctrl" | "alt";

export type TerminalAccessoryAction =
  | {
      readonly kind: "send";
      readonly key: string;
      readonly label: string;
      readonly accessibilityLabel?: string;
      readonly data: string;
      readonly appliesModifier?: boolean;
    }
  | { readonly kind: "clear"; readonly key: string; readonly label: string }
  | {
      readonly kind: "modifier";
      readonly key: string;
      readonly label: string;
      readonly modifier: TerminalModifier;
    };

export const TERMINAL_ACCESSORY_ACTIONS: ReadonlyArray<TerminalAccessoryAction> = [
  { kind: "send", key: "esc", label: "esc", accessibilityLabel: "Escape", data: "\u001b" },
  { kind: "modifier", key: "ctrl", label: "ctrl", modifier: "ctrl" },
  {
    kind: "send",
    key: "ctrl-c",
    label: "ctrl+c",
    accessibilityLabel: "Control C",
    data: "\u0003",
    appliesModifier: false,
  },
  { kind: "modifier", key: "alt", label: "alt", modifier: "alt" },
  { kind: "send", key: "tab", label: "tab", data: "\t" },
  {
    kind: "send",
    key: "shift-tab",
    label: "⇧ tab",
    accessibilityLabel: "Shift Tab",
    data: "\u001b[Z",
    appliesModifier: false,
  },
  { kind: "send", key: "slash", label: "/", accessibilityLabel: "Forward slash", data: "/" },
  { kind: "send", key: "left", label: "←", accessibilityLabel: "Left arrow", data: "\u001b[D" },
  { kind: "send", key: "down", label: "↓", accessibilityLabel: "Down arrow", data: "\u001b[B" },
  { kind: "send", key: "up", label: "↑", accessibilityLabel: "Up arrow", data: "\u001b[A" },
  { kind: "send", key: "right", label: "→", accessibilityLabel: "Right arrow", data: "\u001b[C" },
  { kind: "send", key: "pipe", label: "|", accessibilityLabel: "Pipe", data: "|" },
  { kind: "send", key: "tilde", label: "~", accessibilityLabel: "Tilde", data: "~" },
  { kind: "send", key: "dash", label: "-", accessibilityLabel: "Dash", data: "-" },
  { kind: "clear", key: "clear", label: "clear" },
];

const TERMINAL_ACCESSORY_ACTIONS_WITHOUT_CLEAR = TERMINAL_ACCESSORY_ACTIONS.filter(
  (action) => action.kind !== "clear",
);

export function getTerminalAccessoryActions(options: {
  readonly includeClear: boolean;
}): ReadonlyArray<TerminalAccessoryAction> {
  return options.includeClear
    ? TERMINAL_ACCESSORY_ACTIONS
    : TERMINAL_ACCESSORY_ACTIONS_WITHOUT_CLEAR;
}

export function applyCtrlModifier(input: string): string {
  const firstCharacter = input[0];
  if (!firstCharacter) {
    return input;
  }

  const lowerCharacter = firstCharacter.toLowerCase();
  let controlCharacter: string | null = null;

  if (lowerCharacter >= "a" && lowerCharacter <= "z") {
    controlCharacter = String.fromCharCode(lowerCharacter.charCodeAt(0) - 96);
  } else if (firstCharacter === "@" || firstCharacter === " ") {
    controlCharacter = "\u0000";
  } else if (firstCharacter === "[") {
    controlCharacter = "\u001b";
  } else if (firstCharacter === "\\") {
    controlCharacter = "\u001c";
  } else if (firstCharacter === "]") {
    controlCharacter = "\u001d";
  } else if (firstCharacter === "^") {
    controlCharacter = "\u001e";
  } else if (firstCharacter === "_" || firstCharacter === "-") {
    controlCharacter = "\u001f";
  } else if (firstCharacter === "?") {
    controlCharacter = "\u007f";
  }

  return controlCharacter === null ? input : `${controlCharacter}${input.slice(1)}`;
}

export function applyTerminalModifier(input: string, modifier: TerminalModifier | null): string {
  if (modifier === "ctrl") {
    return applyCtrlModifier(input);
  }
  if (modifier === "alt") {
    return `\u001b${input}`;
  }
  return input;
}

export function resolveTerminalAccessoryInput(
  action: Extract<TerminalAccessoryAction, { readonly kind: "send" }>,
  modifier: TerminalModifier | null,
): string {
  return action.appliesModifier === false
    ? action.data
    : applyTerminalModifier(action.data, modifier);
}

const TERMINAL_ACCESSORY_SEMANTIC_KEYS: Partial<
  Record<string, TerminalSemanticKey>
> = {
  esc: "esc",
  "ctrl-c": "ctrl+c",
  tab: "tab",
  "shift-tab": "shift+tab",
  left: "left",
  down: "down",
  up: "up",
  right: "right",
};

export function resolveTerminalAccessorySemanticKey(
  action: TerminalAccessoryAction,
  modifier: TerminalModifier | null,
): TerminalSemanticKey | null {
  if (action.kind !== "send") return null;

  const semanticKey = TERMINAL_ACCESSORY_SEMANTIC_KEYS[action.key];
  if (semanticKey === undefined) return null;
  if (modifier === null || action.appliesModifier === false) return semanticKey;

  return `${modifier}+${semanticKey as TerminalSemanticBaseKey}`;
}
