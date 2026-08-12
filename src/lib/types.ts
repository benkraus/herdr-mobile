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

export type TerminalSubmitKey = "Enter" | "Tab";
export type TerminalKey = TerminalSubmitKey | "Backspace";

export interface ReplyRequest {
  text: string;
  requestId: string;
}

export interface UploadImageRequest {
  name: string;
  mimeType: string;
  dataUrl: string;
  /** Native picker URI used by the platform's streaming multipart uploader. */
  uri?: string;
}

export type UploadImageResponse = { ok: true; path: string } | { ok: false; error: string };

export interface WorkspaceFileEntry {
  path: string;
  kind: "file" | "directory";
}

export interface WorkspaceFilesResponse {
  workspaceId: string;
  root: string;
  entries: WorkspaceFileEntry[];
  truncated: boolean;
}

export interface WorkspaceFileResponse {
  workspaceId: string;
  path: string;
  mediaType: string;
  encoding: "utf8" | "base64";
  content: string;
  size: number;
}

export interface WorkspaceGitFile {
  path: string;
  status: string;
  indexStatus: string;
  worktreeStatus: string;
  insertions: number;
  deletions: number;
}

export interface WorkspaceGitStatusResponse {
  workspaceId: string;
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  insertions: number;
  deletions: number;
  files: WorkspaceGitFile[];
}

export interface WorkspaceGitDiffResponse {
  workspaceId: string;
  path: string;
  patch: string;
  truncated: boolean;
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
