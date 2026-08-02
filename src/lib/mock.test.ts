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
});
