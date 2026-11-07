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
    }
  | {
      readonly kind: "paste";
      readonly key: "paste";
      readonly label: string;
      readonly accessibilityLabel?: string;
    }
  | {
      readonly kind: "copy-buffer";
      readonly key: "copy-buffer";
      readonly label: string;
      readonly accessibilityLabel?: string;
    }
  | {
      readonly kind: "new-space";
      readonly key: "new-space";
      readonly label: string;
      readonly accessibilityLabel?: string;
    }
  | {
      readonly kind: "close-session";
      readonly key: "close-session";
      readonly label: string;
      readonly accessibilityLabel?: string;
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
  { kind: "paste", key: "paste", label: "paste", accessibilityLabel: "Paste from clipboard" },
  {
    kind: "copy-buffer",
    key: "copy-buffer",
    label: "copy",
    accessibilityLabel: "Copy terminal buffer",
  },
  { kind: "new-space", key: "new-space", label: "+ space", accessibilityLabel: "New space" },
  {
    kind: "close-session",
    key: "close-session",
    label: "close",
    accessibilityLabel: "Close active session",
  },
  { kind: "clear", key: "clear", label: "clear" },
];

export function getTerminalAccessoryActions(options?: {
  readonly includeClear?: boolean;
  readonly includeNewSpace?: boolean;
  readonly includeCloseSession?: boolean;
}): ReadonlyArray<TerminalAccessoryAction> {
  const includeClear = options?.includeClear ?? false;
  const includeNewSpace = options?.includeNewSpace ?? true;
  const includeCloseSession = options?.includeCloseSession ?? true;

  return TERMINAL_ACCESSORY_ACTIONS.filter((action) => {
    if (action.kind === "clear") return includeClear;
    if (action.kind === "new-space") return includeNewSpace;
    if (action.kind === "close-session") return includeCloseSession;
    return true;
  });
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
