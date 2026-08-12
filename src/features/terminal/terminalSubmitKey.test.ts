import { describe, expect, it } from "vitest";

import { terminalSubmitKeyForAgent } from "./terminalSubmitKey";

describe("terminal submit keys", () => {
  it("queues input only while the agent is working", () => {
    expect(terminalSubmitKeyForAgent({ agent: "codex", status: "working" })).toBe("Tab");
    expect(terminalSubmitKeyForAgent({ agent: "codex", status: "blocked" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "codex", status: "done" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "codex", status: "idle" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "codex", status: "unknown" })).toBe("Enter");
  });

  it("defaults non-Codex agents to Enter while they are working", () => {
    expect(terminalSubmitKeyForAgent({ agent: "grok", status: "working" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "claude", status: "working" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "opencode", status: "working" })).toBe("Enter");
    expect(terminalSubmitKeyForAgent({ agent: "unknown", status: "working" })).toBe("Enter");
  });
});
