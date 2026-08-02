import { describe, expect, it } from "vitest";

import { demoPaneById, demoSnapshot } from "./mock";

describe("Herdr demo terminal output", () => {
  it("uses terminal newlines that return the cursor to column zero", () => {
    for (const pane of Object.values(demoPaneById)) {
      expect(pane.text).not.toMatch(/(^|[^\r])\n/);
    }
  });

  it("shows Codex and Grok as distinct tabs in the primary demo space", () => {
    const primaryTabs = demoSnapshot.tabs.filter((tab) => tab.workspaceId === "w1");
    const agentsByTab = new Map(
      demoSnapshot.agents.map((agent) => [agent.tabId, agent.agent] as const),
    );

    expect(primaryTabs.map((tab) => tab.label)).toEqual(["codex", "grok"]);
    expect(primaryTabs.map((tab) => agentsByTab.get(tab.tabId))).toEqual(["codex", "grok"]);
  });

  it("replays recognizable captures from the installed Codex and Grok CLIs", () => {
    const codex = demoPaneById["w1:p1"]?.text ?? "";
    const grok = demoPaneById["w1:p2"]?.text ?? "";

    expect(codex).toContain("OpenAI Codex");
    expect(codex).toContain("v0.146.0");
    expect(codex).toContain("gpt-5.6-terra medium");
    expect(codex).toContain("Use /skills to list available skills");

    expect(grok).toContain("Grok 4.5 (high)");
    expect(grok).toContain("always-approve");
    expect(grok).toContain("Grok Build");
    expect(grok).toContain("0.2.114 [stable]");
  });

  it("uses fictional non-Herdr project names and paths", () => {
    const projectText = [
      ...demoSnapshot.workspaces.flatMap((workspace) => [
        workspace.label,
        workspace.worktree?.repoRoot ?? "",
        workspace.worktree?.checkoutPath ?? "",
      ]),
      ...demoSnapshot.agents.map((agent) => agent.cwd),
      ...demoSnapshot.shellPanes.map((pane) => pane.cwd),
    ].join("\n");

    expect(projectText).not.toMatch(/herdr/i);
  });

  it("does not expose capture paths, local usernames, or synthetic CLI copy", () => {
    const terminalText = Object.values(demoPaneById)
      .map((pane) => pane.text)
      .join("\n");

    expect(terminalText).not.toMatch(/herdr-cli-capture|\/private\/tmp|\/Users\/benkraus/i);
    expect(terminalText).not.toContain("I inspected Northstar");
    expect(terminalText).not.toContain("Analyze the relay boundary");
  });
});
