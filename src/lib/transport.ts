import { normalizeBaseUrl } from "./model";
import type {
  ActionResponse,
  ConnectionConfig,
  CreateTabRequest,
  CreateWorkspaceRequest,
  CreateWorktreeRequest,
  HerdrTerminalKey,
  PaneReadResponse,
  ReplyRequest,
  SnapshotResponse,
  TabCreateResponse,
  TerminalSubmitKey,
  UploadImageRequest,
  UploadImageResponse,
  WorkspaceFileResponse,
  WorkspaceFilesResponse,
  WorkspaceGitDiffResponse,
  WorkspaceGitStatusResponse,
  WorkspaceCreateResponse,
  WorktreeCreateResponse,
} from "./types";

const READ_TIMEOUT_MS = 10_000;
const WRITE_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const WORKSPACE_LIST_TIMEOUT_MS = 30_000;
const WORKSPACE_FILE_TIMEOUT_MS = 60_000;
const WORKSPACE_GIT_TIMEOUT_MS = 70_000;
const WORKSPACE_DIFF_TIMEOUT_MS = 90_000;
const AGENT_STATUSES = new Set(["idle", "working", "blocked", "done", "unknown"]);

export interface WorkspaceInspectionOptions {
  paneId?: string;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
  throw new Error("Herdr Control returned an incompatible response.");
}

function bridgeErrorMessage(detail: string, statusText: string): string {
  try {
    const body = JSON.parse(detail) as unknown;
    if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
      return body.error.trim();
    }
  } catch {
    // Plain-text bridge errors are already human-readable.
  }
  return detail.trim() || statusText || "Herdr request failed.";
}

function workspaceInspectionQuery(
  path: string | undefined,
  options: WorkspaceInspectionOptions | undefined,
): string {
  const params = new URLSearchParams();
  if (path !== undefined) params.set("path", path);
  if (options?.paneId) params.set("paneId", options.paneId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function isAgent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.paneId === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.workspaceLabel === "string" &&
    typeof value.workspaceNumber === "number" &&
    typeof value.tabId === "string" &&
    typeof value.agent === "string" &&
    typeof value.status === "string" &&
    AGENT_STATUSES.has(value.status) &&
    typeof value.cwd === "string" &&
    typeof value.focused === "boolean" &&
    (value.kind === undefined || value.kind === "agent" || value.kind === "shell")
  );
}

function isWorkspaceWorktree(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.repoKey === "string" &&
    typeof value.repoName === "string" &&
    typeof value.repoRoot === "string" &&
    typeof value.checkoutPath === "string" &&
    typeof value.isLinkedWorktree === "boolean"
  );
}

function isWorkspace(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.number === "number" &&
    typeof value.label === "string" &&
    typeof value.focused === "boolean" &&
    typeof value.activeTabId === "string" &&
    typeof value.tabCount === "number" &&
    typeof value.paneCount === "number" &&
    (value.worktree === undefined || isWorkspaceWorktree(value.worktree))
  );
}

function decodeSnapshot(value: unknown): SnapshotResponse {
  if (!isRecord(value)) return invalidResponse();
  const validWorkspaces = Array.isArray(value.workspaces) && value.workspaces.every(isWorkspace);
  const validTabs =
    Array.isArray(value.tabs) &&
    value.tabs.every(
      (item) =>
        isRecord(item) &&
        typeof item.tabId === "string" &&
        typeof item.workspaceId === "string" &&
        typeof item.number === "number" &&
        typeof item.label === "string" &&
        typeof item.focused === "boolean" &&
        typeof item.paneCount === "number",
    );
  const validDevice =
    value.device === undefined ||
    (isRecord(value.device) &&
      typeof value.device.enforced === "boolean" &&
      (value.device.device === null || typeof value.device.device === "string") &&
      typeof value.device.authorized === "boolean");
  const validSessions =
    value.sessions === undefined ||
    (Array.isArray(value.sessions) &&
      value.sessions.every(
        (item) =>
          isRecord(item) &&
          typeof item.name === "string" &&
          typeof item.isPrimary === "boolean" &&
          typeof item.reachable === "boolean" &&
          typeof item.agents === "number" &&
          typeof item.working === "number" &&
          typeof item.blocked === "number",
      ));
  if (
    (value.bridge !== "connected" && value.bridge !== "disconnected") ||
    !Array.isArray(value.agents) ||
    !value.agents.every(isAgent) ||
    !Array.isArray(value.shellPanes) ||
    !value.shellPanes.every(isAgent) ||
    !validWorkspaces ||
    !validTabs ||
    !validDevice ||
    !validSessions ||
    typeof value.ts !== "number"
  )
    return invalidResponse();
  return value as unknown as SnapshotResponse;
}

function decodePane(value: unknown): PaneReadResponse {
  if (
    !isRecord(value) ||
    typeof value.paneId !== "string" ||
    typeof value.text !== "string" ||
    typeof value.truncated !== "boolean" ||
    typeof value.revision !== "number" ||
    (value.notModified !== undefined && typeof value.notModified !== "boolean")
  )
    return invalidResponse();
  return value as unknown as PaneReadResponse;
}

function decodeAction(value: unknown): ActionResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return invalidResponse();
  if (value.ok) return { ok: true };
  if (
    typeof value.error !== "string" ||
    (value.textDelivered !== undefined && typeof value.textDelivered !== "boolean") ||
    (value.deliveryAmbiguous !== undefined && typeof value.deliveryAmbiguous !== "boolean") ||
    (value.cancelled !== undefined && typeof value.cancelled !== "boolean")
  )
    return invalidResponse();
  return value as ActionResponse;
}

function decodeUploadImage(value: unknown): UploadImageResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return invalidResponse();
  if (value.ok) {
    if (typeof value.path !== "string") return invalidResponse();
    return { ok: true, path: value.path };
  }
  if (typeof value.error !== "string") return invalidResponse();
  return { ok: false, error: value.error };
}

function decodeWorkspaceFiles(value: unknown): WorkspaceFilesResponse {
  if (
    !isRecord(value) ||
    typeof value.workspaceId !== "string" ||
    typeof value.root !== "string" ||
    typeof value.truncated !== "boolean" ||
    !Array.isArray(value.entries) ||
    !value.entries.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.path === "string" &&
        (entry.kind === "file" || entry.kind === "directory"),
    )
  )
    return invalidResponse();
  return value as unknown as WorkspaceFilesResponse;
}

function decodeWorkspaceFile(value: unknown): WorkspaceFileResponse {
  if (
    !isRecord(value) ||
    typeof value.workspaceId !== "string" ||
    typeof value.path !== "string" ||
    typeof value.mediaType !== "string" ||
    (value.encoding !== "utf8" && value.encoding !== "base64") ||
    typeof value.content !== "string" ||
    typeof value.size !== "number"
  )
    return invalidResponse();
  return value as unknown as WorkspaceFileResponse;
}

function decodeWorkspaceGitStatus(value: unknown): WorkspaceGitStatusResponse {
  if (
    !isRecord(value) ||
    typeof value.workspaceId !== "string" ||
    typeof value.isRepo !== "boolean" ||
    (value.branch !== null && typeof value.branch !== "string") ||
    (value.upstream !== null && typeof value.upstream !== "string") ||
    typeof value.ahead !== "number" ||
    typeof value.behind !== "number" ||
    typeof value.insertions !== "number" ||
    typeof value.deletions !== "number" ||
    !Array.isArray(value.files) ||
    !value.files.every(
      (file) =>
        isRecord(file) &&
        typeof file.path === "string" &&
        typeof file.status === "string" &&
        typeof file.indexStatus === "string" &&
        typeof file.worktreeStatus === "string" &&
        typeof file.insertions === "number" &&
        typeof file.deletions === "number",
    )
  )
    return invalidResponse();
  return value as unknown as WorkspaceGitStatusResponse;
}

function decodeWorkspaceGitDiff(value: unknown): WorkspaceGitDiffResponse {
  if (
    !isRecord(value) ||
    typeof value.workspaceId !== "string" ||
    typeof value.path !== "string" ||
    typeof value.patch !== "string" ||
    typeof value.truncated !== "boolean"
  )
    return invalidResponse();
  return value as unknown as WorkspaceGitDiffResponse;
}

function imageUploadBlob(request: UploadImageRequest): Blob {
  const prefix = `data:${request.mimeType};base64,`;
  if (!request.dataUrl.startsWith(prefix)) {
    throw new Error("Image data does not match its declared media type.");
  }
  const encoded = request.dataUrl.slice(prefix.length);
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: request.mimeType });
}

function appendImageUpload(data: FormData, request: UploadImageRequest): void {
  if (request.uri?.startsWith("content://")) {
    data.append("file", {
      uri: request.uri,
      name: request.name,
      type: request.mimeType,
    } as unknown as Blob);
    return;
  }
  data.append("file", imageUploadBlob(request), request.name);
}

function isCreatedPane(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.paneId === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.workspaceLabel === "string" &&
    typeof value.tabId === "string" &&
    typeof value.cwd === "string"
  );
}

function decodeCreate(value: unknown): TabCreateResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return invalidResponse();
  if (value.ok) {
    if (!isCreatedPane(value.pane)) return invalidResponse();
    return value as unknown as TabCreateResponse;
  }
  if (
    typeof value.error !== "string" ||
    (value.deliveryAmbiguous !== undefined && typeof value.deliveryAmbiguous !== "boolean")
  )
    return invalidResponse();
  return value as unknown as TabCreateResponse;
}

function decodeWorktreeCreate(value: unknown): WorktreeCreateResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return invalidResponse();
  if (value.ok) {
    if (
      !isCreatedPane(value.pane) ||
      !isWorkspace(value.workspace) ||
      !isRecord(value.tab) ||
      typeof value.tab.tabId !== "string" ||
      typeof value.tab.workspaceId !== "string" ||
      typeof value.tab.number !== "number" ||
      typeof value.tab.label !== "string" ||
      typeof value.tab.focused !== "boolean" ||
      typeof value.tab.paneCount !== "number"
    )
      return invalidResponse();
    return value as unknown as WorktreeCreateResponse;
  }
  if (
    typeof value.error !== "string" ||
    (value.deliveryAmbiguous !== undefined && typeof value.deliveryAmbiguous !== "boolean")
  )
    return invalidResponse();
  return value as unknown as WorktreeCreateResponse;
}

export interface HerdrTransport {
  snapshot(signal?: AbortSignal): Promise<SnapshotResponse>;
  pane(paneId: string, signal?: AbortSignal): Promise<PaneReadResponse>;
  reply(paneId: string, request: ReplyRequest, signal?: AbortSignal): Promise<ActionResponse>;
  uploadImage(
    paneId: string,
    request: UploadImageRequest,
    signal?: AbortSignal,
  ): Promise<UploadImageResponse>;
  input(paneId: string, data: string, signal?: AbortSignal): Promise<ActionResponse>;
  key(paneId: string, key: HerdrTerminalKey, signal?: AbortSignal): Promise<ActionResponse>;
  submit(
    paneId: string,
    data: string,
    key: TerminalSubmitKey,
    signal?: AbortSignal,
  ): Promise<ActionResponse>;
  focusPane(paneId: string, signal?: AbortSignal): Promise<ActionResponse>;
  createTab(request: CreateTabRequest, signal?: AbortSignal): Promise<TabCreateResponse>;
  createWorkspace(
    request: CreateWorkspaceRequest,
    signal?: AbortSignal,
  ): Promise<WorkspaceCreateResponse>;
  renameTab(tabId: string, label: string, signal?: AbortSignal): Promise<ActionResponse>;
  closeTab(tabId: string, requestId: string, signal?: AbortSignal): Promise<ActionResponse>;
  closeWorkspace(
    workspaceId: string,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ActionResponse>;
  createWorktree(
    request: CreateWorktreeRequest,
    signal?: AbortSignal,
  ): Promise<WorktreeCreateResponse>;
  removeWorktree(
    workspaceId: string,
    force: boolean,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ActionResponse>;
  workspaceFiles(
    workspaceId: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceFilesResponse>;
  workspaceFile(
    workspaceId: string,
    path: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceFileResponse>;
  workspaceGit(
    workspaceId: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceGitStatusResponse>;
  workspaceDiff(
    workspaceId: string,
    path: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceGitDiffResponse>;
}

export type HerdrLiveEvent =
  | { type: "connected" }
  | { type: "source_status"; live: boolean }
  | { type: "snapshot_changed" }
  | { type: "pane_output_changed"; paneId: string; revision: number }
  | { type: "pane_stream_status"; paneId: string; live: boolean; reason?: string }
  | {
      type: "pane_frame";
      paneId: string;
      seq: number;
      full: boolean;
      width: number;
      height: number;
      text: string;
    };

export interface TerminalGridSize {
  cols: number;
  rows: number;
}

export interface HerdrLiveSubscription {
  close(): void;
  watchPane(paneId: string | undefined, size?: TerminalGridSize): void;
  scrollPane(paneId: string, rows: number): void;
}

export function buildLiveUrl(baseUrl: string, session: string | undefined): string {
  const url = new URL(normalizeBaseUrl(baseUrl) + "/api/live");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (session?.trim()) url.searchParams.set("session", session.trim());
  return url.toString();
}

export function decodeLiveEvent(data: unknown): HerdrLiveEvent | null {
  if (typeof data !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "connected" || value.type === "snapshot_changed") {
    return { type: value.type };
  }
  if (value.type === "source_status" && typeof value.live === "boolean") {
    return { type: "source_status", live: value.live };
  }
  if (
    value.type === "pane_stream_status" &&
    typeof value.paneId === "string" &&
    typeof value.live === "boolean" &&
    (value.reason === undefined || typeof value.reason === "string")
  ) {
    return {
      type: "pane_stream_status",
      paneId: value.paneId,
      live: value.live,
      ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    };
  }
  if (
    value.type === "pane_frame" &&
    typeof value.paneId === "string" &&
    typeof value.seq === "number" &&
    Number.isSafeInteger(value.seq) &&
    value.seq >= 0 &&
    typeof value.full === "boolean" &&
    typeof value.width === "number" &&
    Number.isSafeInteger(value.width) &&
    value.width > 0 &&
    typeof value.height === "number" &&
    Number.isSafeInteger(value.height) &&
    value.height > 0 &&
    typeof value.bytes === "string"
  ) {
    const text = decodeBase64Utf8(value.bytes);
    if (text === null) return null;
    return {
      type: "pane_frame",
      paneId: value.paneId,
      seq: value.seq,
      full: value.full,
      width: value.width,
      height: value.height,
      text,
    };
  }
  if (
    value.type === "pane_output_changed" &&
    typeof value.paneId === "string" &&
    typeof value.revision === "number" &&
    Number.isFinite(value.revision)
  ) {
    return { type: "pane_output_changed", paneId: value.paneId, revision: value.revision };
  }
  return null;
}

export function decodeBase64Utf8(value: string): string | null {
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export class HerdrHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: string,
  ) {
    super(message);
    this.name = "HerdrHttpError";
  }
}

export function isUnknownSessionError(error: unknown, session: string): boolean {
  if (!(error instanceof HerdrHttpError) || error.status !== 404) return false;
  try {
    const body = JSON.parse(error.detail) as { error?: unknown };
    return body.error === `unknown session: ${session}`;
  } catch {
    return false;
  }
}

export function isUnsupportedTerminalSubmitError(error: unknown): boolean {
  return error instanceof HerdrHttpError && (error.status === 404 || error.status === 405);
}

function timedSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    },
  };
}

export class HerdrHttpTransport implements HerdrTransport {
  private readonly baseUrl: string;
  private readonly session?: string;

  constructor(config: ConnectionConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.session = config.session?.trim() || undefined;
  }

  snapshot(signal?: AbortSignal): Promise<SnapshotResponse> {
    return this.request("/api/snapshot", { signal }, decodeSnapshot);
  }

  pane(paneId: string, signal?: AbortSignal): Promise<PaneReadResponse> {
    return this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "?lines=320",
      { signal },
      decodePane,
    );
  }

  reply(paneId: string, request: ReplyRequest, signal?: AbortSignal): Promise<ActionResponse> {
    return this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "/reply",
      {
        method: "POST",
        body: JSON.stringify({ text: request.text, submit: true, requestId: request.requestId }),
        signal,
      },
      decodeAction,
    );
  }

  async uploadImage(
    paneId: string,
    request: UploadImageRequest,
    signal?: AbortSignal,
  ): Promise<UploadImageResponse> {
    if (request.uri?.startsWith("file://")) {
      const url = new URL(this.baseUrl + "/api/pane/" + encodeURIComponent(paneId) + "/upload");
      if (this.session) url.searchParams.set("session", this.session);
      const requestSignal = timedSignal(signal, UPLOAD_TIMEOUT_MS);
      try {
        const { File, UploadType } = await import("expo-file-system");
        const result = await new File(request.uri).upload(url.toString(), {
          httpMethod: "POST",
          uploadType: UploadType.MULTIPART,
          fieldName: "file",
          mimeType: request.mimeType,
          headers: { "x-herdr-client": "herdr-mobile-v1" },
          signal: requestSignal.signal,
        });
        if (result.status < 200 || result.status >= 300) {
          throw new HerdrHttpError(result.status, result.status + " " + result.body, result.body);
        }
        return decodeUploadImage(JSON.parse(result.body));
      } finally {
        requestSignal.dispose();
      }
    }
    const data = new FormData();
    appendImageUpload(data, request);
    return await this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "/upload",
      { method: "POST", body: data, signal },
      decodeUploadImage,
      UPLOAD_TIMEOUT_MS,
    );
  }

  input(paneId: string, data: string, signal?: AbortSignal): Promise<ActionResponse> {
    if (data === "\u007F") {
      return this.key(paneId, "Backspace", signal);
    }
    return this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "/input",
      { method: "POST", body: JSON.stringify({ data }), signal },
      decodeAction,
    );
  }

  key(paneId: string, key: HerdrTerminalKey, signal?: AbortSignal): Promise<ActionResponse> {
    return this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "/keys",
      { method: "POST", body: JSON.stringify({ keys: [key] }), signal },
      decodeAction,
    );
  }

  submit(
    paneId: string,
    data: string,
    key: TerminalSubmitKey,
    signal?: AbortSignal,
  ): Promise<ActionResponse> {
    return this.request(
      "/api/pane/" + encodeURIComponent(paneId) + "/submit",
      { method: "POST", body: JSON.stringify({ data, key }), signal },
      decodeAction,
    );
  }

  focusPane(paneId: string, signal?: AbortSignal): Promise<ActionResponse> {
    return this.request(
      "/api/focus/" + encodeURIComponent(paneId),
      { method: "POST", body: JSON.stringify({}), signal },
      decodeAction,
    );
  }

  createTab(request: CreateTabRequest, signal?: AbortSignal): Promise<TabCreateResponse> {
    return this.request(
      "/api/tab",
      { method: "POST", body: JSON.stringify(request), signal },
      decodeCreate,
    );
  }

  createWorkspace(
    request: CreateWorkspaceRequest,
    signal?: AbortSignal,
  ): Promise<WorkspaceCreateResponse> {
    return this.request(
      "/api/workspace",
      { method: "POST", body: JSON.stringify(request), signal },
      decodeCreate,
    );
  }

  renameTab(tabId: string, label: string, signal?: AbortSignal): Promise<ActionResponse> {
    return this.request(
      "/api/tab/" + encodeURIComponent(tabId),
      { method: "PATCH", body: JSON.stringify({ label }), signal },
      decodeAction,
    );
  }

  closeTab(tabId: string, requestId: string, signal?: AbortSignal): Promise<ActionResponse> {
    return this.request(
      "/api/tab/" + encodeURIComponent(tabId),
      { method: "DELETE", body: JSON.stringify({ requestId }), signal },
      decodeAction,
    );
  }

  closeWorkspace(
    workspaceId: string,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ActionResponse> {
    return this.request(
      "/api/workspace/" + encodeURIComponent(workspaceId),
      { method: "DELETE", body: JSON.stringify({ requestId }), signal },
      decodeAction,
    );
  }

  workspaceFiles(
    workspaceId: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceFilesResponse> {
    return this.request(
      "/api/workspace/" +
        encodeURIComponent(workspaceId) +
        "/files" +
        workspaceInspectionQuery(undefined, options),
      { signal: options?.signal },
      decodeWorkspaceFiles,
      WORKSPACE_LIST_TIMEOUT_MS,
    );
  }

  workspaceFile(
    workspaceId: string,
    path: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceFileResponse> {
    return this.request(
      "/api/workspace/" +
        encodeURIComponent(workspaceId) +
        "/file" +
        workspaceInspectionQuery(path, options),
      { signal: options?.signal },
      decodeWorkspaceFile,
      WORKSPACE_FILE_TIMEOUT_MS,
    );
  }

  workspaceGit(
    workspaceId: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceGitStatusResponse> {
    return this.request(
      "/api/workspace/" +
        encodeURIComponent(workspaceId) +
        "/git" +
        workspaceInspectionQuery(undefined, options),
      { signal: options?.signal },
      decodeWorkspaceGitStatus,
      WORKSPACE_GIT_TIMEOUT_MS,
    );
  }

  workspaceDiff(
    workspaceId: string,
    path: string,
    options?: WorkspaceInspectionOptions,
  ): Promise<WorkspaceGitDiffResponse> {
    return this.request(
      "/api/workspace/" +
        encodeURIComponent(workspaceId) +
        "/diff" +
        workspaceInspectionQuery(path, options),
      { signal: options?.signal },
      decodeWorkspaceGitDiff,
      WORKSPACE_DIFF_TIMEOUT_MS,
    );
  }

  subscribeLive(listener: (event: HerdrLiveEvent) => void): HerdrLiveSubscription {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryIndex = 0;
    let closed = false;
    let watchedPane: string | null = null;
    let watchedSize: TerminalGridSize = { cols: 120, rows: 40 };
    let pendingScrollRows = 0;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const retryMs = [500, 1_000, 2_000, 5_000];
    const sendWatch = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: "watch_pane",
          paneId: watchedPane,
          cols: watchedSize.cols,
          rows: watchedSize.rows,
        }),
      );
    };
    const flushScroll = () => {
      scrollTimer = null;
      const rows = pendingScrollRows;
      pendingScrollRows = 0;
      if (!socket || socket.readyState !== WebSocket.OPEN || !watchedPane || rows === 0) return;
      socket.send(
        JSON.stringify({
          type: "scroll_pane",
          paneId: watchedPane,
          direction: rows > 0 ? "down" : "up",
          lines: Math.min(Math.abs(rows), 200),
        }),
      );
    };
    const connect = () => {
      if (closed) return;
      socket = new WebSocket(buildLiveUrl(this.baseUrl, this.session));
      socket.onopen = () => {
        retryIndex = 0;
        sendWatch();
      };
      socket.onmessage = (message) => {
        const event = decodeLiveEvent(message.data);
        if (event) listener(event);
      };
      socket.onerror = () => {
        // onclose owns reconnect scheduling; React Native reports both for transport failures.
      };
      socket.onclose = () => {
        socket = null;
        listener({ type: "source_status", live: false });
        if (watchedPane) {
          listener({ type: "pane_stream_status", paneId: watchedPane, live: false });
        }
        if (closed) return;
        const delay = retryMs[Math.min(retryIndex, retryMs.length - 1)]!;
        retryIndex += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };
    connect();
    return {
      watchPane: (paneId, size) => {
        if (watchedPane !== (paneId ?? null)) pendingScrollRows = 0;
        watchedPane = paneId ?? null;
        if (size) watchedSize = size;
        sendWatch();
      },
      scrollPane: (paneId, rows) => {
        if (paneId !== watchedPane || !Number.isFinite(rows)) return;
        pendingScrollRows += Math.trunc(rows);
        if (!scrollTimer) scrollTimer = setTimeout(flushScroll, 16);
      },
      close: () => {
        closed = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (scrollTimer) clearTimeout(scrollTimer);
        retryTimer = null;
        scrollTimer = null;
        pendingScrollRows = 0;
        socket?.close();
        socket = null;
      },
    };
  }

  createWorktree(
    request: CreateWorktreeRequest,
    signal?: AbortSignal,
  ): Promise<WorktreeCreateResponse> {
    return this.request(
      "/api/worktree",
      { method: "POST", body: JSON.stringify(request), signal },
      decodeWorktreeCreate,
    );
  }

  removeWorktree(
    workspaceId: string,
    force: boolean,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ActionResponse> {
    return this.request(
      "/api/worktree/" + encodeURIComponent(workspaceId),
      { method: "DELETE", body: JSON.stringify({ force, requestId }), signal },
      decodeAction,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    decode: (value: unknown) => T,
    timeoutMs?: number,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    const browserOrigin = globalThis.location?.origin;
    if (browserOrigin && url.origin !== browserOrigin) {
      throw new Error(
        "Live web connections require a same-origin Herdr bridge. Use the native app or proxy /api through this origin.",
      );
    }
    if (this.session) url.searchParams.set("session", this.session);
    const method = init.method?.toUpperCase() ?? "GET";
    const requestSignal = timedSignal(
      init.signal ?? undefined,
      timeoutMs ?? (method === "GET" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS),
    );
    try {
      const response = await fetch(url, {
        ...init,
        signal: requestSignal.signal,
        headers: init.body
          ? {
              ...(typeof init.body === "string" ? { "content-type": "application/json" } : {}),
              "x-herdr-client": "herdr-mobile-v1",
              ...init.headers,
            }
          : init.headers,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        throw new HerdrHttpError(
          response.status,
          bridgeErrorMessage(detail, response.statusText),
          detail,
        );
      }
      return decode(await response.json());
    } finally {
      requestSignal.dispose();
    }
  }
}
