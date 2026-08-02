import { describe, expect, it } from "vitest";
import { plainTerminalText } from "./terminal";

describe("plainTerminalText", () => {
  it("removes ANSI control sequences without removing their text", () => {
    expect(plainTerminalText("\u001b[31merror\u001b[0m\nready")).toBe("error\nready");
  });

  it("keeps only the final carriage-return redraw for each line", () => {
    expect(plainTerminalText("working 10%\rworking 90%\rready\r\nnext")).toBe("ready\nnext");
  });

  it("removes adjacent OSC hyperlink controls without consuming visible labels", () => {
    expect(plainTerminalText("\u001b]8;;https://example.com\u001b\\label\u001b]8;;\u001b\\")).toBe("label");
  });
});
