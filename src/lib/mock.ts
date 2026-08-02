import type { PaneReadResponse, SnapshotResponse } from "./types";

export const demoSnapshot: SnapshotResponse = {
  bridge: "connected",
  agents: [
    { paneId: "w1:p1", workspaceId: "w1", workspaceLabel: "northstar", workspaceNumber: 1, tabId: "w1:t1", agent: "codex", status: "blocked", cwd: "/Users/demo/Projects/northstar", focused: true },
    { paneId: "w1:p2", workspaceId: "w1", workspaceLabel: "northstar", workspaceNumber: 1, tabId: "w1:t2", agent: "grok", status: "working", cwd: "/Users/demo/Projects/northstar", focused: false },
    { paneId: "w2:p1", workspaceId: "w2", workspaceLabel: "wayfinder", workspaceNumber: 2, tabId: "w2:t1", agent: "claude", status: "working", cwd: "/Users/demo/Projects/wayfinder", focused: false },
    { paneId: "w3:p1", workspaceId: "w3", workspaceLabel: "northstar-docs", workspaceNumber: 3, tabId: "w3:t1", agent: "opencode", status: "done", cwd: "/Users/demo/Projects/northstar-docs", focused: false },
    { paneId: "w4:p1", workspaceId: "w4", workspaceLabel: "orbit-site", workspaceNumber: 4, tabId: "w4:t1", agent: "claude", status: "idle", cwd: "/Users/demo/Projects/orbit-site", focused: false },
  ],
  shellPanes: [],
  workspaces: [
    { workspaceId: "w1", number: 1, label: "northstar", focused: true, activeTabId: "w1:t1", tabCount: 2, paneCount: 2, worktree: { repoKey: "/Users/demo/Projects/northstar/.git", repoName: "northstar", repoRoot: "/Users/demo/Projects/northstar", checkoutPath: "/Users/demo/Projects/northstar", isLinkedWorktree: false } },
    { workspaceId: "w2", number: 2, label: "wayfinder", focused: false, activeTabId: "w2:t1", tabCount: 1, paneCount: 1 },
    { workspaceId: "w3", number: 3, label: "northstar-docs", focused: false, activeTabId: "w3:t1", tabCount: 1, paneCount: 1, worktree: { repoKey: "/Users/demo/Projects/northstar/.git", repoName: "northstar", repoRoot: "/Users/demo/Projects/northstar", checkoutPath: "/Users/demo/.worktrees/northstar/docs", isLinkedWorktree: true } },
    { workspaceId: "w4", number: 4, label: "orbit-site", focused: false, activeTabId: "w4:t1", tabCount: 1, paneCount: 1 },
  ],
  tabs: [
    { tabId: "w1:t1", workspaceId: "w1", number: 1, label: "codex", focused: true, paneCount: 1 },
    { tabId: "w1:t2", workspaceId: "w1", number: 2, label: "grok", focused: false, paneCount: 1 },
    { tabId: "w2:t1", workspaceId: "w2", number: 1, label: "main", focused: true, paneCount: 1 },
    { tabId: "w3:t1", workspaceId: "w3", number: 1, label: "main", focused: true, paneCount: 1 },
    { tabId: "w4:t1", workspaceId: "w4", number: 1, label: "ios-client", focused: true, paneCount: 1 },
  ],
  sessions: [
    { name: "default", isPrimary: true, reachable: true, agents: 5, working: 2, blocked: 1 },
  ],
  ts: Date.now(),
};

const mainOutput = [
  "\u001b[1;36mCodex\u001b[0m  ·  \u001b[33mgpt-5.4\u001b[0m  ·  full access",
  "~/Projects/northstar",
  "",
  "I inspected Northstar and its mobile protocol boundaries.",
  "",
  "The relay stays beside Northstar so agent sessions survive mobile disconnects.",
  "The app reads spaces, tabs, panes, and status through a bounded REST API.",
  "",
  "Completed",
  "  \u001b[32m✓\u001b[0m mapped demo spaces into the split navigator",
  "  ✓ kept agents globally visible by urgency",
  "  ✓ scoped tabbed windows to the selected space",
  "  ✓ isolated the Tailscale HTTP transport from the UI",
  "",
  "Before I continue: should the new agent start in this space?",
].join("\r\n");

const grokOutput = [
  "\u001b[1;35mGrok\u001b[0m  ·  \u001b[36mgrok-code-fast-1\u001b[0m  ·  auto",
  "~/Projects/northstar",
  "",
  "> Analyze the relay boundary and image upload flow",
  "",
  "Working",
  "  \u001b[32m✓\u001b[0m read the mobile client transport",
  "  \u001b[32m✓\u001b[0m traced staged uploads through the relay",
  "  \u001b[36m•\u001b[0m comparing reconnect behavior across both paths",
].join("\r\n");

export const demoPaneById: Record<string, PaneReadResponse> = Object.fromEntries(
  [...demoSnapshot.agents, ...demoSnapshot.shellPanes].map((pane) => [
    pane.paneId,
    {
      paneId: pane.paneId,
      text:
        pane.paneId === "w1:p1"
          ? mainOutput
          : pane.paneId === "w1:p2"
            ? grokOutput
            : [
                pane.agent + " · " + pane.workspaceLabel,
                pane.cwd,
                "",
                "Session is " + pane.status + ".",
                "",
                "This preview uses the explicit demo transport.",
              ].join("\r\n"),
      truncated: false,
      revision: 1,
    },
  ]),
);
