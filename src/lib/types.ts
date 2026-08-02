export type AgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface AgentView {
  paneId: string;
  workspaceId: string;
  workspaceLabel: string;
  workspaceNumber: number;
  tabId: string;
  agent: string;
  status: AgentStatus;
  cwd: string;
  focused: boolean;
  kind?: "agent" | "shell";
}

export interface WorkspaceView {
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  activeTabId: string;
  tabCount: number;
  paneCount: number;
  worktree?: WorkspaceWorktreeView;
}

export interface WorkspaceWorktreeView {
  repoKey: string;
  repoName: string;
  repoRoot: string;
  checkoutPath: string;
  isLinkedWorktree: boolean;
}

export interface TabView {
  tabId: string;
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  paneCount: number;
}

export interface SessionSummary {
  name: string;
  isPrimary: boolean;
  reachable: boolean;
  agents: number;
  working: number;
  blocked: number;
}

export interface DeviceAuth {
  enforced: boolean;
  device: string | null;
  authorized: boolean;
}

export interface SnapshotResponse {
  bridge: "connected" | "disconnected";
  device?: DeviceAuth;
  agents: AgentView[];
  shellPanes: AgentView[];
  workspaces: WorkspaceView[];
  tabs: TabView[];
  sessions?: SessionSummary[];
  ts: number;
}

export interface PaneReadResponse {
  paneId: string;
  text: string;
  truncated: boolean;
  revision: number;
  notModified?: boolean;
}

export type ActionResponse =
  | { ok: true }
  | {
      ok: false;
      error: string;
      textDelivered?: boolean;
      deliveryAmbiguous?: boolean;
      cancelled?: boolean;
    };

export interface ReplyRequest {
  text: string;
  requestId: string;
}

export interface CreatedPane {
  paneId: string;
  workspaceId: string;
  workspaceLabel: string;
  tabId: string;
  cwd: string;
}

export interface CreateTabRequest {
  workspaceId: string;
  label?: string;
  requestId: string;
}

export type TabCreateResponse =
  | { ok: true; pane: CreatedPane }
  | { ok: false; error: string; deliveryAmbiguous?: boolean };

export interface CreateWorkspaceRequest {
  label?: string;
  cwd?: string;
  requestId: string;
}

export type WorkspaceCreateResponse =
  | { ok: true; pane: CreatedPane }
  | { ok: false; error: string; deliveryAmbiguous?: boolean };

export interface CreateWorktreeRequest {
  workspaceId: string;
  branch?: string;
  base?: string;
  label?: string;
  requestId: string;
}

export type WorktreeCreateResponse =
  | { ok: true; pane: CreatedPane; workspace: WorkspaceView; tab: TabView }
  | { ok: false; error: string; deliveryAmbiguous?: boolean };

export type ConnectionMode = "unconfigured" | "connecting" | "live" | "offline" | "demo";

export interface ConnectionConfig {
  baseUrl: string;
  session?: string;
}
