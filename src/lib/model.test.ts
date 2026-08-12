import { describe, expect, it } from "vitest";
import { allPanes, defaultSpace, focusedSelection, groupWorkspaces, normalizeBaseUrl, paneForTab, sortedAgents, tabsForSpace } from "./model";
import { demoSnapshot } from "./mock";

describe("Herdr navigation model", () => {
  it("opens the space containing the agent that needs input", () => {
    expect(defaultSpace(demoSnapshot)?.workspaceId).toBe("w1");
  });

  it("keeps tabs scoped and ordered inside their space", () => {
    expect(tabsForSpace(demoSnapshot, "w1").map((tab) => tab.tabId)).toEqual([
      "w1:t1",
      "w1:t2",
    ]);
  });

  it("preserves Herdr's tab array order instead of sorting by public number", () => {
    const first = { ...demoSnapshot.tabs[1]!, number: 32 };
    const second = { ...demoSnapshot.tabs[0]!, number: 17 };
    const snapshot = { ...demoSnapshot, tabs: [first, second] };

    expect(tabsForSpace(snapshot, "w1").map((tab) => tab.tabId)).toEqual([
      first.tabId,
      second.tabId,
    ]);
  });

  it("chooses the agent-bearing pane for a tab", () => {
    expect(paneForTab(demoSnapshot, "w1:t1")?.agent).toBe("codex");
  });

  it("derives the exact workspace, tab, and pane focused by Herdr", () => {
    const selection = focusedSelection(demoSnapshot);
    const focusedWorkspace = demoSnapshot.workspaces.find((workspace) => workspace.focused);
    const focusedTab = demoSnapshot.tabs.find((tab) => tab.focused);
    const focusedPane = allPanes(demoSnapshot).find((pane) => pane.focused);
    expect(selection).toEqual({
      workspaceId: focusedWorkspace?.workspaceId,
      tabId: focusedTab?.tabId,
      paneId: focusedPane?.paneId,
    });
  });

  it("nests linked worktrees beneath their main repository workspace", () => {
    const groups = groupWorkspaces(demoSnapshot);
    const repository = groups.find((group) => group.parent?.workspaceId === "w1");
    expect(repository?.worktrees.map((workspace) => workspace.workspaceId)).toEqual(["w3"]);
    expect(groups.some((group) => group.parent?.workspaceId === "w3")).toBe(false);
  });

  it("retains every shell and agent pane for multi-pane tab selection", () => {
    const snapshot = {
      ...demoSnapshot,
      shellPanes: [
        ...demoSnapshot.shellPanes,
        {
          ...demoSnapshot.agents[0]!,
          paneId: "w1:t1:extra",
          tabId: "w1:t1",
          agent: "shell",
          kind: "shell" as const,
          focused: false,
        },
      ],
    };
    expect(allPanes(snapshot).filter((pane) => pane.tabId === "w1:t1").map((pane) => pane.paneId)).toContain("w1:t1:extra");
  });

  it("sorts agents by attention priority", () => {
    const snapshot = {
      ...demoSnapshot,
      agents: [
        ...demoSnapshot.agents,
        { ...demoSnapshot.agents[0]!, paneId: "unknown", status: "unknown" as const },
      ],
    };
    expect(sortedAgents(snapshot).map((agent) => agent.status)).toEqual([
      "blocked",
      "working",
      "working",
      "unknown",
      "idle",
      "done",
    ]);
  });

  it("normalizes a tailnet bridge URL", () => {
    expect(normalizeBaseUrl(" https://buildbox.example.ts.net/// ")).toBe(
      "https://buildbox.example.ts.net",
    );
    expect(() => normalizeBaseUrl("ssh://buildbox")).toThrow(/http/);
    expect(() => normalizeBaseUrl("http://buildbox.example.ts.net")).toThrow(/https/);
    expect(normalizeBaseUrl("http://127.0.0.1:8787/")).toBe("http://127.0.0.1:8787");
    expect(normalizeBaseUrl("http://[::1]:8787/")).toBe("http://[::1]:8787");
    expect(() => normalizeBaseUrl("https://buildbox.example.ts.net/?proxy=1")).toThrow(/query/);
    expect(() => normalizeBaseUrl("https://buildbox.example.ts.net/#settings")).toThrow(/fragment/);
  });
});
