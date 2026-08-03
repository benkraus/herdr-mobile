import type {
  PaneReadResponse,
  SnapshotResponse,
  WorkspaceFileResponse,
  WorkspaceFilesResponse,
  WorkspaceGitDiffResponse,
  WorkspaceGitStatusResponse,
} from "./types";

export const demoSnapshot: SnapshotResponse = {
  bridge: "connected",
  agents: [
    {
      paneId: "w1:p1",
      workspaceId: "w1",
      workspaceLabel: "northstar",
      workspaceNumber: 1,
      tabId: "w1:t1",
      agent: "codex",
      status: "blocked",
      cwd: "/Users/demo/Projects/northstar",
      focused: true,
    },
    {
      paneId: "w1:p2",
      workspaceId: "w1",
      workspaceLabel: "northstar",
      workspaceNumber: 1,
      tabId: "w1:t2",
      agent: "grok",
      status: "working",
      cwd: "/Users/demo/Projects/northstar",
      focused: false,
    },
    {
      paneId: "w2:p1",
      workspaceId: "w2",
      workspaceLabel: "wayfinder",
      workspaceNumber: 2,
      tabId: "w2:t1",
      agent: "claude",
      status: "working",
      cwd: "/Users/demo/Projects/wayfinder",
      focused: false,
    },
    {
      paneId: "w3:p1",
      workspaceId: "w3",
      workspaceLabel: "northstar-docs",
      workspaceNumber: 3,
      tabId: "w3:t1",
      agent: "opencode",
      status: "done",
      cwd: "/Users/demo/Projects/northstar-docs",
      focused: false,
    },
    {
      paneId: "w4:p1",
      workspaceId: "w4",
      workspaceLabel: "orbit-site",
      workspaceNumber: 4,
      tabId: "w4:t1",
      agent: "claude",
      status: "idle",
      cwd: "/Users/demo/Projects/orbit-site",
      focused: false,
    },
  ],
  shellPanes: [],
  workspaces: [
    {
      workspaceId: "w1",
      number: 1,
      label: "northstar",
      focused: true,
      activeTabId: "w1:t1",
      tabCount: 2,
      paneCount: 2,
      worktree: {
        repoKey: "/Users/demo/Projects/northstar/.git",
        repoName: "northstar",
        repoRoot: "/Users/demo/Projects/northstar",
        checkoutPath: "/Users/demo/Projects/northstar",
        isLinkedWorktree: false,
      },
    },
    {
      workspaceId: "w2",
      number: 2,
      label: "wayfinder",
      focused: false,
      activeTabId: "w2:t1",
      tabCount: 1,
      paneCount: 1,
    },
    {
      workspaceId: "w3",
      number: 3,
      label: "northstar-docs",
      focused: false,
      activeTabId: "w3:t1",
      tabCount: 1,
      paneCount: 1,
      worktree: {
        repoKey: "/Users/demo/Projects/northstar/.git",
        repoName: "northstar",
        repoRoot: "/Users/demo/Projects/northstar",
        checkoutPath: "/Users/demo/.worktrees/northstar/docs",
        isLinkedWorktree: true,
      },
    },
    {
      workspaceId: "w4",
      number: 4,
      label: "orbit-site",
      focused: false,
      activeTabId: "w4:t1",
      tabCount: 1,
      paneCount: 1,
    },
  ],
  tabs: [
    { tabId: "w1:t1", workspaceId: "w1", number: 1, label: "codex", focused: true, paneCount: 1 },
    { tabId: "w1:t2", workspaceId: "w1", number: 2, label: "grok", focused: false, paneCount: 1 },
    { tabId: "w2:t1", workspaceId: "w2", number: 1, label: "main", focused: true, paneCount: 1 },
    { tabId: "w3:t1", workspaceId: "w3", number: 1, label: "main", focused: true, paneCount: 1 },
    {
      tabId: "w4:t1",
      workspaceId: "w4",
      number: 1,
      label: "ios-client",
      focused: true,
      paneCount: 1,
    },
  ],
  sessions: [
    { name: "default", isPrimary: true, reachable: true, agents: 5, working: 2, blocked: 1 },
  ],
  ts: Date.now(),
};

// Sanitized from a real Codex 0.146.0 startup frame captured in an empty repository.
// Only the working directory differs from the captured terminal output.
const mainOutput = [
  "",
  "\u001b[2m╭──────────────────────────────────────────────────────╮\u001b[0m",
  "\u001b[2m│ >_ \u001b[22m\u001b[1mOpenAI Codex\u001b[22m\u001b[2m (v0.146.0)                           │\u001b[0m",
  "\u001b[2m│                                                      │\u001b[0m",
  "\u001b[2m│ model:       \u001b[22mgpt-5.6-terra medium\u001b[2m   \u001b[22m\u001b[38;5;6m/model\u001b[2m\u001b[39m to change │\u001b[0m",
  "\u001b[2m│ directory:   \u001b[22m~/Projects/northstar\u001b[2m                    │\u001b[0m",
  "\u001b[2m│ permissions: \u001b[22m\u001b[1m\u001b[38;5;5mYOLO mode\u001b[22m\u001b[2m\u001b[39m                               │\u001b[0m",
  "\u001b[2m╰──────────────────────────────────────────────────────╯\u001b[0m",
  "",
  "  \u001b[1mTip:\u001b[22m \u001b[3mNew\u001b[23m Build faster with the \u001b[1mDesktop app\u001b[22m. Run 'codex app' or visit",
  "  https://chatgpt.com/codex?app-landing-page=true",
  "",
  "\u001b[1m›\u001b[22m \u001b[2mUse /skills to list available skills\u001b[0m",
  "",
  "  \u001b[38;2;246;226;183mgpt-5.6-terra medium\u001b[2m\u001b[39m · \u001b[22m\u001b[38;2;171;223;167m~/Projects/northstar\u001b[0m\u001b[13;3H",
].join("\r\n");

// Sanitized from a real Grok Build 0.2.114 startup frame captured at 80×24.
// The screen contents, spacing, colors, menu, model, and footer mirror the steady TUI frame.
const grokOutput = [
  "\u001b[48;5;233m\u001b[2J\u001b[H",
  "  \u001b[38;5;240m~/Projects/northstar\u001b[39m",
  "",
  "",
  "",
  "               \u001b[1m\u001b[38;5;254mNew worktree\u001b[22m\u001b[39m                                 \u001b[38;5;243mctrl+w\u001b[39m",
  "               \u001b[1m\u001b[38;5;254mResume session\u001b[22m\u001b[39m                               \u001b[38;5;243mctrl+s\u001b[39m",
  "               \u001b[1m\u001b[38;5;254mChangelog\u001b[22m\u001b[39m",
  "               \u001b[1m\u001b[38;5;254mQuit\u001b[22m\u001b[39m                                         \u001b[38;5;243mctrl+q\u001b[39m",
  "",
  "               \u001b[1m\u001b[38;5;179mWorkflows are here!\u001b[22m\u001b[39m",
  "               \u001b[38;5;242mTry them out using /workflows.\u001b[39m",
  "",
  "",
  "",
  "",
  "  \u001b[1m\u001b[38;5;251mUpdate: \u001b[22mv0.2.118 available — press ctrl+u to restart\u001b[39m",
  "",
  "  \u001b[38;5;239m╭──────────────────────────────────────────────────────────────────────────╮\u001b[39m",
  "  \u001b[38;5;239m│\u001b[38;5;254m \u001b[38;5;251m❯ \u001b[38;5;254m                                                                       \u001b[38;5;239m│\u001b[39m",
  "  \u001b[38;5;239m╰─────────────────────────────────────── \u001b[38;5;244mGrok 4.5 (high)\u001b[38;5;240m · \u001b[38;5;242malways-approve\u001b[38;5;239m ─╯\u001b[39m",
  "",
  "                                             \u001b[1m\u001b[38;5;254mGrok Build  \u001b[22m\u001b[38;5;242m0.2.114 [stable]\u001b[1m\u001b[38;5;254m Beta\u001b[22m\u001b[39m",
  "\u001b[0m\u001b[20;7H",
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

const demoFileContents: Record<string, string> = {
  "README.md": "# Northstar\n\nA durable Herdr workspace for the mobile preview.\n",
  "package.json": '{\n  "name": "northstar",\n  "private": true\n}\n',
  "src/App.tsx": [
    'import { Text, View } from "react-native";',
    "",
    "export function App() {",
    "  return <View><Text>Northstar</Text></View>;",
    "}",
    "",
  ].join("\n"),
  "src/lib/client.ts": 'export const apiBaseUrl = "https://api.example.com";\n',
  "docs/notes.md": "# Notes\n\n- Add workspace browsing\n- Review Git changes\n",
};

export const demoWorkspaceFiles: Record<string, WorkspaceFilesResponse> = Object.fromEntries(
  demoSnapshot.workspaces.map((workspace) => [
    workspace.workspaceId,
    {
      workspaceId: workspace.workspaceId,
      root:
        workspace.worktree?.checkoutPath ??
        demoSnapshot.agents.find((pane) => pane.workspaceId === workspace.workspaceId)?.cwd ??
        "/Users/demo/Projects/unknown",
      entries: Object.keys(demoFileContents).map((path) => ({ path, kind: "file" as const })),
      truncated: false,
    },
  ]),
);

export function demoWorkspaceFile(workspaceId: string, path: string): WorkspaceFileResponse | null {
  const content = demoFileContents[path];
  if (content === undefined) return null;
  return {
    workspaceId,
    path,
    mediaType: path.endsWith(".md") ? "text/markdown" : "text/plain",
    encoding: "utf8",
    content,
    size: content.length,
  };
}

export const demoWorkspaceGit: Record<string, WorkspaceGitStatusResponse> = Object.fromEntries(
  demoSnapshot.workspaces.map((workspace) => [
    workspace.workspaceId,
    {
      workspaceId: workspace.workspaceId,
      isRepo: true,
      branch: workspace.workspaceId === "w3" ? "docs/mobile" : "main",
      upstream: workspace.workspaceId === "w3" ? "origin/docs/mobile" : "origin/main",
      ahead: workspace.workspaceId === "w1" ? 1 : 0,
      behind: 0,
      insertions: 14,
      deletions: 3,
      files: [
        {
          path: "src/App.tsx",
          status: "Modified",
          indexStatus: " ",
          worktreeStatus: "M",
          insertions: 9,
          deletions: 3,
        },
        {
          path: "docs/notes.md",
          status: "Untracked",
          indexStatus: "?",
          worktreeStatus: "?",
          insertions: 5,
          deletions: 0,
        },
      ],
    },
  ]),
);

export function demoWorkspaceDiff(
  workspaceId: string,
  path: string,
): WorkspaceGitDiffResponse | null {
  if (!demoWorkspaceGit[workspaceId]?.files.some((file) => file.path === path)) return null;
  const patch =
    path === "src/App.tsx"
      ? [
          "diff --git a/src/App.tsx b/src/App.tsx",
          "--- a/src/App.tsx",
          "+++ b/src/App.tsx",
          "@@ -2,4 +2,5 @@",
          " ",
          " export function App() {",
          "-  return <Text>Northstar</Text>;",
          "+  return <View><Text>Northstar</Text></View>;",
          " }",
        ].join("\n")
      : [
          `diff --git a/${path} b/${path}`,
          "new file mode 100644",
          "--- /dev/null",
          `+++ b/${path}`,
          "@@ -0,0 +1,4 @@",
          "+# Notes",
          "+",
          "+- Add workspace browsing",
          "+- Review Git changes",
        ].join("\n");
  return { workspaceId, path, patch, truncated: false };
}
