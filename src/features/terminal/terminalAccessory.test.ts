import { describe, expect, it } from "vite-plus/test";

import {
  applyCtrlModifier,
  applyTerminalModifier,
  getTerminalAccessoryActions,
  resolveTerminalAccessoryInput,
  resolveTerminalAccessorySemanticKey,
  TERMINAL_ACCESSORY_ACTIONS,
} from "./terminalAccessory";

describe("TERMINAL_ACCESSORY_ACTIONS", () => {
  it("includes the requested terminal shortcuts in an intentional order", () => {
    expect(TERMINAL_ACCESSORY_ACTIONS.map((action) => action.key)).toEqual([
      "esc",
      "ctrl",
      "ctrl-c",
      "alt",
      "tab",
      "shift-tab",
      "slash",
      "left",
      "down",
      "up",
      "right",
      "pipe",
      "tilde",
      "dash",
      "clear",
    ]);
  });

  it("uses standard terminal sequences for arrows and reverse tab", () => {
    const sendActions = TERMINAL_ACCESSORY_ACTIONS.filter(
      (action) => action.kind === "send",
    );
    const dataByKey = Object.fromEntries(sendActions.map((action) => [action.key, action.data]));

    expect(dataByKey).toMatchObject({
      left: "\u001b[D",
      down: "\u001b[B",
      up: "\u001b[A",
      right: "\u001b[C",
      "shift-tab": "\u001b[Z",
    });
  });

  it("can omit clear when the active terminal backend cannot clear its buffer", () => {
    expect(getTerminalAccessoryActions({ includeClear: false }).map((action) => action.key)).toEqual(
      TERMINAL_ACCESSORY_ACTIONS.filter((action) => action.kind !== "clear").map(
        (action) => action.key,
      ),
    );
    expect(getTerminalAccessoryActions({ includeClear: true })).toBe(TERMINAL_ACCESSORY_ACTIONS);
  });
});

describe("terminal modifiers", () => {
  it("maps Ctrl plus letters and terminal punctuation to control bytes", () => {
    expect(applyCtrlModifier("c")).toBe("\u0003");
    expect(applyCtrlModifier("C")).toBe("\u0003");
    expect(applyCtrlModifier("[")).toBe("\u001b");
    expect(applyCtrlModifier("?")).toBe("\u007f");
  });

  it("applies a one-shot modifier to the first character without dropping a larger input chunk", () => {
    expect(applyCtrlModifier("cat")).toBe("\u0003at");
    expect(applyTerminalModifier("x", "alt")).toBe("\u001bx");
  });

  it("sends dedicated multi-key shortcuts exactly", () => {
    const ctrlC = TERMINAL_ACCESSORY_ACTIONS.find((action) => action.key === "ctrl-c");
    const shiftTab = TERMINAL_ACCESSORY_ACTIONS.find((action) => action.key === "shift-tab");

    expect(ctrlC?.kind).toBe("send");
    expect(shiftTab?.kind).toBe("send");
    if (ctrlC?.kind !== "send" || shiftTab?.kind !== "send") {
      throw new Error("Expected send actions");
    }

    expect(resolveTerminalAccessoryInput(ctrlC, "alt")).toBe("\u0003");
    expect(resolveTerminalAccessoryInput(shiftTab, "ctrl")).toBe("\u001b[Z");
  });

  it("resolves control sequences to Herdr semantic keys", () => {
    const actions = Object.fromEntries(
      TERMINAL_ACCESSORY_ACTIONS.map((action) => [action.key, action]),
    );

    expect(resolveTerminalAccessorySemanticKey(actions.esc!, null)).toBe("esc");
    expect(resolveTerminalAccessorySemanticKey(actions["ctrl-c"]!, "alt")).toBe("ctrl+c");
    expect(resolveTerminalAccessorySemanticKey(actions["shift-tab"]!, "ctrl")).toBe(
      "shift+tab",
    );
    expect(resolveTerminalAccessorySemanticKey(actions.left!, "alt")).toBe("alt+left");
    expect(resolveTerminalAccessorySemanticKey(actions.slash!, null)).toBeNull();
  });
});
