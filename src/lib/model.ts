import type { AgentView, SnapshotResponse, TabView, WorkspaceView } from "./types";

export interface WorkspaceHierarchyGroup {
  key: string;
  title: string;
  parent: WorkspaceView | null;
  worktrees: WorkspaceView[];
}

export function allPanes(snapshot: SnapshotResponse): AgentView[] {
  return [...snapshot.agents, ...snapshot.shellPanes];
}

export function panesForSpace(snapshot: SnapshotResponse, workspaceId: string): AgentView[] {
  return allPanes(snapshot).filter((pane) => pane.workspaceId === workspaceId);
}

export function tabsForSpace(snapshot: SnapshotResponse, workspaceId: string): TabView[] {
  return snapshot.tabs
    .filter((tab) => tab.workspaceId === workspaceId)
    .sort((left, right) => left.number - right.number);
}

/** Match Herdr's navigator: linked checkouts live beneath their repository's main workspace. */
export function groupWorkspaces(snapshot: SnapshotResponse): WorkspaceHierarchyGroup[] {
  const ordered = [...snapshot.workspaces].sort((left, right) => left.number - right.number);
  const parentByRepo = new Map(
    ordered
      .filter((workspace) => workspace.worktree && !workspace.worktree.isLinkedWorktree)
      .map((workspace) => [workspace.worktree!.repoKey, workspace]),
  );
  const emittedRepos = new Set<string>();
  const groups: WorkspaceHierarchyGroup[] = [];

  for (const workspace of ordered) {
    const identity = workspace.worktree;
    if (!identity) {
      groups.push({
        key: workspace.workspaceId,
        title: workspace.label,
        parent: workspace,
        worktrees: [],
      });
      continue;
    }
    if (emittedRepos.has(identity.repoKey)) continue;
    if (identity.isLinkedWorktree && parentByRepo.has(identity.repoKey)) continue;
    emittedRepos.add(identity.repoKey);
    const parent = parentByRepo.get(identity.repoKey) ?? null;
    groups.push({
      key: `repo:${identity.repoKey}`,
      title: parent?.label ?? identity.repoName,
      parent,
      worktrees: ordered.filter(
        (candidate) =>
          candidate.worktree?.repoKey === identity.repoKey &&
          candidate.worktree.isLinkedWorktree,
      ),
    });
  }

  return groups;
}

export function defaultSpace(snapshot: SnapshotResponse): WorkspaceView | undefined {
  const urgent = snapshot.agents.find((agent) => agent.status === "blocked");
  return (
    snapshot.workspaces.find((workspace) => workspace.workspaceId === urgent?.workspaceId) ??
    snapshot.workspaces.find((workspace) => workspace.focused) ??
    snapshot.workspaces[0]
  );
}

export function defaultTab(snapshot: SnapshotResponse, workspaceId: string): TabView | undefined {
  const workspace = snapshot.workspaces.find((item) => item.workspaceId === workspaceId);
  const tabs = tabsForSpace(snapshot, workspaceId);
  return (
    tabs.find((tab) => tab.tabId === workspace?.activeTabId) ??
    tabs.find((tab) => tab.focused) ??
    tabs[0]
  );
}

export function paneForTab(snapshot: SnapshotResponse, tabId: string): AgentView | undefined {
  const panes = allPanes(snapshot).filter((pane) => pane.tabId === tabId);
  return (
    panes.find((pane) => pane.status === "blocked") ??
    panes.find((pane) => pane.focused) ??
    panes.find((pane) => pane.kind !== "shell") ??
    panes[0]
  );
}

export interface HerdrSelection {
  workspaceId: string | undefined;
  tabId: string | undefined;
  paneId: string | undefined;
}

/** The exact navigator selection owned by Herdr's TUI/server snapshot. */
export function focusedSelection(snapshot: SnapshotResponse): HerdrSelection {
  const panes = allPanes(snapshot);
  const focusedPane = panes.find((pane) => pane.focused);
  const focusedTab = snapshot.tabs.find((tab) => tab.focused) ??
    snapshot.tabs.find((tab) => tab.tabId === focusedPane?.tabId);
  const focusedWorkspace = snapshot.workspaces.find((workspace) => workspace.focused) ??
    snapshot.workspaces.find((workspace) => workspace.workspaceId === focusedPane?.workspaceId);
  return {
    workspaceId: focusedWorkspace?.workspaceId,
    tabId: focusedTab?.tabId ?? focusedWorkspace?.activeTabId,
    paneId: focusedPane?.paneId,
  };
}

export function statusPriority(status: AgentView["status"]): number {
  return { blocked: 0, working: 1, unknown: 2, idle: 3, done: 4 }[status];
}

export function sortedAgents(snapshot: SnapshotResponse): AgentView[] {
  return [...snapshot.agents].sort(
    (left, right) =>
      statusPriority(left.status) - statusPriority(right.status) ||
      left.workspaceNumber - right.workspaceNumber ||
      left.paneId.localeCompare(right.paneId),
  );
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Use an http:// or https:// bridge URL.");
  }
  // React Native's URL polyfill does not reliably expose a bracketed IPv6
  // hostname, so recognize the exact loopback authority from the input.
  const ipv6Loopback = /^http:\/\/\[::1\](?::\d+)?(?:\/|$)/i.test(trimmed);
  const loopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    ipv6Loopback;
  if (parsed.protocol === "http:" && !loopback) {
    throw new Error("Remote Herdr bridges must use https://. Plain HTTP is allowed only on loopback for development.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("Bridge URLs cannot contain a query string or fragment.");
  }
  return parsed.toString().replace(/\/$/, "");
}
