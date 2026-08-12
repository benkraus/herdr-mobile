import { describe, expect, it } from "vitest";

import { terminalKeyInputData, terminalKeyNeedsInputSettle } from "./terminalKeys";

describe("terminal key input data", () => {
  it("maps semantic keys to terminal control bytes", () => {
    expect(terminalKeyInputData("Enter")).toBe("\r");
    expect(terminalKeyInputData("Tab")).toBe("\t");
    expect(terminalKeyInputData("Backspace")).toBe("\u007F");
  });

  it("settles submit keys after preceding terminal text", () => {
    expect(terminalKeyNeedsInputSettle("Enter")).toBe(true);
    expect(terminalKeyNeedsInputSettle("Tab")).toBe(true);
    expect(terminalKeyNeedsInputSettle("Backspace")).toBe(false);
  });
});
