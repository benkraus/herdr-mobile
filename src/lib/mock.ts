import type { PaneReadResponse, SnapshotResponse } from "./types";

export const demoSnapshot: SnapshotResponse = {
  bridge: "connected",
  agents: [
    { paneId: "w1:p1", workspaceId: "w1", workspaceLabel: "herdr-control", workspaceNumber: 1, tabId: "w1:t1", agent: "codex", status: "blocked", cwd: "/Users/demo/Projects/herdr-control", focused: true },
    { paneId: "w2:p1", workspaceId: "w2", workspaceLabel: "herdr", workspaceNumber: 2, tabId: "w2:t1", agent: "claude", status: "working", cwd: "/Users/demo/Projects/herdr", focused: false },
    { paneId: "w3:p1", workspaceId: "w3", workspaceLabel: "herdr-docs", workspaceNumber: 3, tabId: "w3:t1", agent: "opencode", status: "done", cwd: "/Users/demo/Projects/herdr-docs", focused: false },
    { paneId: "w4:p1", workspaceId: "w4", workspaceLabel: "herdr-site", workspaceNumber: 4, tabId: "w4:t1", agent: "claude", status: "idle", cwd: "/Users/demo/Projects/herdr-site", focused: false },
  ],
  shellPanes: [
    { paneId: "w1:p2", workspaceId: "w1", workspaceLabel: "herdr-control", workspaceNumber: 1, tabId: "w1:t2", agent: "shell", status: "idle", cwd: "/Users/demo/Projects/herdr-control", focused: false, kind: "shell" },
  ],
  workspaces: [
    { workspaceId: "w1", number: 1, label: "herdr-control", focused: true, activeTabId: "w1:t1", tabCount: 2, paneCount: 2, worktree: { repoKey: "/Users/demo/Projects/herdr-control/.git", repoName: "herdr-control", repoRoot: "/Users/demo/Projects/herdr-control", checkoutPath: "/Users/demo/Projects/herdr-control", isLinkedWorktree: false } },
    { workspaceId: "w2", number: 2, label: "herdr", focused: false, activeTabId: "w2:t1", tabCount: 1, paneCount: 1 },
    { workspaceId: "w3", number: 3, label: "herdr-docs", focused: false, activeTabId: "w3:t1", tabCount: 1, paneCount: 1, worktree: { repoKey: "/Users/demo/Projects/herdr-control/.git", repoName: "herdr-control", repoRoot: "/Users/demo/Projects/herdr-control", checkoutPath: "/Users/demo/.herdr/worktrees/herdr-control/docs", isLinkedWorktree: true } },
    { workspaceId: "w4", number: 4, label: "herdr-site", focused: false, activeTabId: "w4:t1", tabCount: 1, paneCount: 1 },
  ],
  tabs: [
    { tabId: "w1:t1", workspaceId: "w1", number: 1, label: "control-plane", focused: true, paneCount: 1 },
    { tabId: "w1:t2", workspaceId: "w1", number: 2, label: "shell", focused: false, paneCount: 1 },
    { tabId: "w2:t1", workspaceId: "w2", number: 1, label: "main", focused: true, paneCount: 1 },
    { tabId: "w3:t1", workspaceId: "w3", number: 1, label: "main", focused: true, paneCount: 1 },
    { tabId: "w4:t1", workspaceId: "w4", number: 1, label: "ios-client", focused: true, paneCount: 1 },
  ],
  sessions: [
    { name: "default", isPrimary: true, reachable: true, agents: 4, working: 1, blocked: 1 },
  ],
  ts: Date.now(),
};

const mainOutput = [
  "\u001b[1;36mCodex\u001b[0m  ·  \u001b[33mgpt-5.4\u001b[0m  ·  full access",
  "~/Projects/herdr-control",
  "",
  "I inspected T3 Code, Herdr, and the bridge protocol boundaries.",
  "",
  "The bridge stays beside Herdr so agent sessions survive mobile disconnects.",
  "The app reads spaces, tabs, panes, and status through a bounded REST API.",
  "",
  "Completed",
  "  \u001b[32m✓\u001b[0m mapped Herdr spaces into the split navigator",
  "  ✓ kept agents globally visible by urgency",
  "  ✓ scoped tabbed windows to the selected space",
  "  ✓ isolated the Tailscale HTTP transport from the UI",
  "",
  "Before I continue: should the new agent start in this space?",
].join("\n");

export const demoPaneById: Record<string, PaneReadResponse> = Object.fromEntries(
  [...demoSnapshot.agents, ...demoSnapshot.shellPanes].map((pane) => [
    pane.paneId,
    {
      paneId: pane.paneId,
      text: pane.paneId === "w1:p1" ? mainOutput : [
        pane.agent + " · " + pane.workspaceLabel,
        pane.cwd,
        "",
        "Session is " + pane.status + ".",
        "",
        "This preview uses the explicit demo transport.",
      ].join("\n"),
      truncated: false,
      revision: 1,
    },
  ]),
);
