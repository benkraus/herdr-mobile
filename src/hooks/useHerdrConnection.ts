import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoPaneById, demoSnapshot } from "../lib/mock";
import { normalizeBaseUrl } from "../lib/model";
import { parseConnection } from "../lib/connectionConfig";
import { loadConnection, saveConnection } from "../lib/storage";
import {
  HerdrHttpTransport,
  isUnknownSessionError,
  type HerdrLiveEvent,
  type HerdrLiveSubscription,
  type TerminalGridSize,
} from "../lib/transport";
import type {
  ActionResponse,
  ConnectionConfig,
  ConnectionMode,
  CreateTabRequest,
  CreateWorkspaceRequest,
  CreateWorktreeRequest,
  PaneReadResponse,
  SnapshotResponse,
  TabCreateResponse,
  WorkspaceCreateResponse,
  WorktreeCreateResponse,
} from "../lib/types";

const emptySnapshot: SnapshotResponse = {
  bridge: "disconnected",
  agents: [],
  shellPanes: [],
  workspaces: [],
  tabs: [],
  sessions: [],
  ts: Date.now(),
};

const envUrl = process.env.EXPO_PUBLIC_HERDR_URL?.trim() ?? "";
const envDemo = process.env.EXPO_PUBLIC_HERDR_DEMO === "1";

function freshDemoOutputs(): Record<string, PaneReadResponse> {
  return Object.fromEntries(
    Object.entries(demoPaneById).map(([paneId, pane]) => [paneId, { ...pane }]),
  );
}

type PaneLiveUpdate = Extract<HerdrLiveEvent, { type: "pane_frame" | "pane_output_changed" }>;

export function useHerdrConnection() {
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(envDemo);
  const [mode, setMode] = useState<ConnectionMode>(envDemo ? "demo" : "connecting");
  const [snapshot, setSnapshot] = useState<SnapshotResponse>(envDemo ? demoSnapshot : emptySnapshot);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(envDemo);
  const hasConnected = useRef(false);
  const demoOutputs = useRef<Record<string, PaneReadResponse>>(freshDemoOutputs());
  const refreshGeneration = useRef(0);
  const refreshInFlight = useRef<{
    generation: number;
    controller: AbortController;
  } | null>(null);
  const writeGeneration = useRef(0);
  const writeInFlight = useRef<AbortController | null>(null);
  const inputQueue = useRef<Promise<void>>(Promise.resolve());
  const paneOutputListeners = useRef(new Map<string, Set<(event: PaneLiveUpdate) => void>>());
  const [liveSourceConnected, setLiveSourceConnected] = useState(false);
  const [paneStreamConnected, setPaneStreamConnected] = useState(false);
  const liveSubscription = useRef<HerdrLiveSubscription | null>(null);

  const transport = useMemo(
    () => (!demoEnabled && config?.baseUrl ? new HerdrHttpTransport(config) : null),
    [config, demoEnabled],
  );
  const activeTransport = useRef(transport);
  activeTransport.current = transport;
  const configGeneration = useRef(0);
  const configWriteChain = useRef<Promise<void>>(Promise.resolve());

  const persistConfig = useCallback((next: ConnectionConfig, generation: number) => {
    const write = configWriteChain.current.then(async () => {
      if (generation !== configGeneration.current) return;
      await saveConnection(next);
    });
    configWriteChain.current = write.catch(() => {});
    return write;
  }, []);

  useEffect(() => {
    if (envDemo) return;
    let mounted = true;
    const generation = configGeneration.current;
    void (async () => {
      try {
        const saved = await loadConnection();
        if (!mounted || generation !== configGeneration.current) return;
        const initial = saved ?? (envUrl ? parseConnection(JSON.stringify({ baseUrl: envUrl })) : null);
        setConfig(initial);
        setMode(initial ? "connecting" : "unconfigured");
      } catch {
        if (!mounted || generation !== configGeneration.current) return;
        setConfig(null);
        setError("Saved connection settings could not be read. Enter the bridge URL again.");
        setMode("unconfigured");
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const invalidateRefresh = useCallback(() => {
    refreshGeneration.current += 1;
    refreshInFlight.current?.controller.abort();
    refreshInFlight.current = null;
    writeGeneration.current += 1;
    writeInFlight.current?.abort();
    writeInFlight.current = null;
    // Invalidate callbacks retained by an in-flight reply before React renders the next transport.
    activeTransport.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const requestedTransport = transport;
    if (!requestedTransport || activeTransport.current !== requestedTransport) return;
    const generation = refreshGeneration.current;
    const configVersion = configGeneration.current;
    if (refreshInFlight.current?.generation === generation) return;
    refreshInFlight.current?.controller.abort();
    const controller = new AbortController();
    refreshInFlight.current = { generation, controller };
    try {
      const next = await requestedTransport.snapshot(controller.signal);
      if (
        controller.signal.aborted ||
        generation !== refreshGeneration.current ||
        configVersion !== configGeneration.current ||
        activeTransport.current !== requestedTransport
      ) return;
      setSnapshot(next);
      if (next.bridge === "connected") {
        setMode("live");
        setError(null);
        hasConnected.current = true;
      } else {
        setMode("offline");
        setError("Herdr Control is reachable, but the Herdr process is disconnected.");
      }
    } catch (reason) {
      if (
        controller.signal.aborted ||
        generation !== refreshGeneration.current ||
        configVersion !== configGeneration.current
      ) return;
      if (config?.session && isUnknownSessionError(reason, config.session)) {
        const primary = { baseUrl: config.baseUrl };
        const configOperation = ++configGeneration.current;
        await persistConfig(primary, configOperation).catch(() => {});
        if (
          controller.signal.aborted ||
          generation !== refreshGeneration.current ||
          activeTransport.current !== requestedTransport ||
          configOperation !== configGeneration.current
        ) return;
        invalidateRefresh();
        setConfig(primary);
        setSnapshot(emptySnapshot);
        setError(`Session '${config.session}' is no longer available. Reconnecting to primary.`);
        setMode("connecting");
        return;
      }
      setSnapshot((current) => ({ ...current, bridge: "disconnected" }));
      setMode("offline");
      setError(
        reason instanceof Error
          ? reason.message
          : hasConnected.current
            ? "The Herdr bridge disconnected."
            : "The Herdr bridge is unavailable.",
      );
    } finally {
      if (refreshInFlight.current?.controller === controller) refreshInFlight.current = null;
    }
  }, [config, invalidateRefresh, persistConfig, transport]);

  useEffect(
    () => () => {
      refreshInFlight.current?.controller.abort();
      writeInFlight.current?.abort();
    },
    [transport],
  );

  useEffect(() => {
    if (!ready || !transport) {
      setLiveSourceConnected(false);
      return;
    }
    let active = true;
    setLiveSourceConnected(false);
    const subscription = transport.subscribeLive((event) => {
      if (!active) return;
      if (event.type === "connected" || event.type === "snapshot_changed") {
        void refresh();
        return;
      }
      if (event.type === "source_status") {
        setLiveSourceConnected(event.live);
        return;
      }
      if (event.type === "pane_stream_status") {
        setPaneStreamConnected(event.live);
        return;
      }
      if (event.type === "pane_frame") setPaneStreamConnected(true);
      const listeners = paneOutputListeners.current.get(event.paneId);
      if (listeners && (event.type === "pane_frame" || event.type === "pane_output_changed")) {
        for (const listener of listeners) listener(event);
      }
    });
    liveSubscription.current = subscription;
    return () => {
      active = false;
      if (liveSubscription.current === subscription) liveSubscription.current = null;
      subscription.close();
    };
  }, [ready, refresh, transport]);

  useEffect(() => {
    if (!ready || !transport) return;
    void refresh();
    const timer = setInterval(
      () => void refresh(),
      mode === "live" && liveSourceConnected ? 30_000 : 5_000,
    );
    return () => clearInterval(timer);
  }, [liveSourceConnected, mode, ready, refresh, transport]);

  const connect = useCallback(async (next: ConnectionConfig) => {
    const normalized = { ...next, baseUrl: normalizeBaseUrl(next.baseUrl) };
    if (!normalized.baseUrl) throw new Error("Enter the Herdr bridge URL.");
    const configOperation = ++configGeneration.current;
    const previousTransport = activeTransport.current;
    invalidateRefresh();
    try {
      await persistConfig(normalized, configOperation);
    } catch (reason) {
      if (configOperation === configGeneration.current) {
        activeTransport.current = previousTransport;
      }
      throw reason;
    }
    if (configOperation !== configGeneration.current) return;
    setDemoEnabled(false);
    setConfig(normalized);
    setSnapshot(emptySnapshot);
    setError(null);
    setMode("connecting");
  }, [invalidateRefresh, persistConfig]);

  const useDemo = useCallback(async () => {
    configGeneration.current += 1;
    invalidateRefresh();
    setDemoEnabled(true);
    setSnapshot(demoSnapshot);
    setError(null);
    setMode("demo");
  }, [invalidateRefresh]);

  const readPane = useCallback(
    async (paneId: string, signal?: AbortSignal): Promise<PaneReadResponse> => {
      if (mode === "demo") {
        const pane = demoOutputs.current[paneId];
        if (!pane) throw new Error("Demo pane not found.");
        return pane;
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      return transport.pane(paneId, signal);
    },
    [mode, transport],
  );

  const sendReply = useCallback(
    async (paneId: string, text: string, requestId: string) => {
      if (mode === "demo") {
        const current = demoOutputs.current[paneId];
        if (!current) return { ok: false as const, error: "Demo pane not found." };
        demoOutputs.current[paneId] = {
          ...current,
          revision: current.revision + 1,
          text: current.text + "\n\n› " + text + "\n\nWorking on that now. The Herdr pane remains durable while this app is away.",
        };
        return { ok: true as const };
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const requestedTransport = transport;
      const generation = writeGeneration.current;
      writeInFlight.current?.abort();
      const controller = new AbortController();
      writeInFlight.current = controller;
      try {
        const result = await requestedTransport.reply(
          paneId,
          { text, requestId },
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          generation !== writeGeneration.current ||
          activeTransport.current !== requestedTransport
        ) {
          return { ok: false as const, error: "Reply cancelled.", cancelled: true };
        }
        return result;
      } catch (reason) {
        if (
          controller.signal.aborted ||
          generation !== writeGeneration.current ||
          activeTransport.current !== requestedTransport
        ) {
          return { ok: false as const, error: "Reply cancelled.", cancelled: true };
        }
        throw reason;
      } finally {
        if (writeInFlight.current === controller) writeInFlight.current = null;
      }
    },
    [mode, transport],
  );

  const sendInput = useCallback(
    (paneId: string, data: string): Promise<ActionResponse> => {
      if (mode === "demo") {
        const current = demoOutputs.current[paneId];
        if (!current) return Promise.resolve({ ok: false, error: "Demo pane not found." });
        demoOutputs.current[paneId] = {
          ...current,
          revision: current.revision + 1,
          text: current.text + data,
        };
        return Promise.resolve({ ok: true });
      }
      const requestedTransport = transport;
      if (!requestedTransport) {
        return Promise.reject(new Error("Connect to a Herdr bridge first."));
      }
      const operation = inputQueue.current.then(async () => {
        if (activeTransport.current !== requestedTransport) {
          return { ok: false as const, error: "Terminal input cancelled.", cancelled: true };
        }
        return requestedTransport.input(paneId, data);
      });
      inputQueue.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [mode, transport],
  );

  const focusPane = useCallback(
    async (paneId: string): Promise<ActionResponse> => {
      if (mode === "demo") {
        setSnapshot((current) => {
          const pane = [...current.agents, ...current.shellPanes].find(
            (candidate) => candidate.paneId === paneId,
          );
          if (!pane) return current;
          return {
            ...current,
            workspaces: current.workspaces.map((workspace) => ({
              ...workspace,
              focused: workspace.workspaceId === pane.workspaceId,
              ...(workspace.workspaceId === pane.workspaceId ? { activeTabId: pane.tabId } : {}),
            })),
            tabs: current.tabs.map((tab) => ({ ...tab, focused: tab.tabId === pane.tabId })),
            agents: current.agents.map((agent) => ({ ...agent, focused: agent.paneId === paneId })),
            shellPanes: current.shellPanes.map((shell) => ({ ...shell, focused: shell.paneId === paneId })),
            ts: Date.now(),
          };
        });
        return { ok: true };
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      return transport.focusPane(paneId);
    },
    [mode, transport],
  );

  const scrollPane = useCallback((paneId: string, rows: number) => {
    liveSubscription.current?.scrollPane(paneId, rows);
  }, []);

  const subscribePaneOutput = useCallback(
    (
      paneId: string,
      size: TerminalGridSize,
      listener: (event: PaneLiveUpdate) => void,
    ): (() => void) => {
      const listeners = paneOutputListeners.current.get(paneId) ?? new Set();
      listeners.add(listener);
      paneOutputListeners.current.set(paneId, listeners);
      setPaneStreamConnected(false);
      liveSubscription.current?.watchPane(paneId, size);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          paneOutputListeners.current.delete(paneId);
          setPaneStreamConnected(false);
          liveSubscription.current?.watchPane(undefined);
        }
      };
    },
    [],
  );

  const createTab = useCallback(
    async (request: CreateTabRequest): Promise<TabCreateResponse> => {
      const workspace = snapshot.workspaces.find(
        (candidate) => candidate.workspaceId === request.workspaceId,
      );
      if (!workspace) return { ok: false, error: "Space or worktree not found." };
      const workspaceTabs = snapshot.tabs.filter(
        (tab) => tab.workspaceId === request.workspaceId,
      );
      const number = Math.max(0, ...snapshot.tabs.map((tab) => tab.number)) + 1;
      const label = request.label?.trim() || String(workspaceTabs.length + 1);

      if (mode === "demo") {
        const tabId = `${workspace.workspaceId}:demo-t${number}-${Date.now()}`;
        const paneId = `${workspace.workspaceId}:demo-p${number}-${Date.now()}`;
        const pane = {
          paneId,
          workspaceId: workspace.workspaceId,
          workspaceLabel: workspace.label,
          tabId,
          cwd: workspace.worktree?.checkoutPath ?? workspace.worktree?.repoRoot ?? "/demo",
        };
        demoOutputs.current[paneId] = {
          paneId,
          text: `\u001b[1;36m${workspace.label}\u001b[0m\r\n$ `,
          truncated: false,
          revision: 1,
        };
        setSnapshot((current) => ({
          ...current,
          workspaces: current.workspaces.map((candidate) =>
            candidate.workspaceId === workspace.workspaceId
              ? {
                  ...candidate,
                  activeTabId: tabId,
                  tabCount: candidate.tabCount + 1,
                  paneCount: candidate.paneCount + 1,
                }
              : candidate,
          ),
          tabs: [
            ...current.tabs,
            { tabId, workspaceId: workspace.workspaceId, number, label, focused: false, paneCount: 1 },
          ],
          shellPanes: [
            ...current.shellPanes,
            {
              ...pane,
              workspaceNumber: workspace.number,
              agent: "shell",
              status: "idle",
              focused: false,
              kind: "shell",
            },
          ],
          ts: Date.now(),
        }));
        return { ok: true, pane };
      }

      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const result = await transport.createTab(request);
      if (result.ok) {
        setSnapshot((current) => {
          const tabAlreadyPresent = current.tabs.some((tab) => tab.tabId === result.pane.tabId);
          const paneAlreadyPresent = [...current.agents, ...current.shellPanes].some(
            (pane) => pane.paneId === result.pane.paneId,
          );
          return {
            ...current,
            workspaces: current.workspaces.map((candidate) =>
              candidate.workspaceId === workspace.workspaceId
                ? {
                    ...candidate,
                    activeTabId: result.pane.tabId,
                    tabCount: candidate.tabCount + (tabAlreadyPresent ? 0 : 1),
                    paneCount: candidate.paneCount + (paneAlreadyPresent ? 0 : 1),
                  }
                : candidate,
            ),
            tabs: tabAlreadyPresent
              ? current.tabs
              : [
                  ...current.tabs,
                  {
                    tabId: result.pane.tabId,
                    workspaceId: workspace.workspaceId,
                    number,
                    label,
                    focused: false,
                    paneCount: 1,
                  },
                ],
            shellPanes: paneAlreadyPresent
              ? current.shellPanes
              : [
                  ...current.shellPanes,
                  {
                    ...result.pane,
                    workspaceNumber: workspace.number,
                    agent: "shell",
                    status: "idle",
                    focused: false,
                    kind: "shell",
                  },
                ],
            ts: Date.now(),
          };
        });
        void refresh();
      }
      return result;
    },
    [mode, refresh, snapshot.tabs, snapshot.workspaces, transport],
  );

  const createWorkspace = useCallback(
    async (request: CreateWorkspaceRequest): Promise<WorkspaceCreateResponse> => {
      const number = Math.max(0, ...snapshot.workspaces.map((workspace) => workspace.number)) + 1;
      const requestedLabel = request.label?.trim();
      const requestedCwd = request.cwd?.trim();

      if (mode === "demo") {
        const workspaceId = `demo-space-${number}-${Date.now()}`;
        const tabId = `${workspaceId}:t1`;
        const paneId = `${workspaceId}:p1`;
        const workspaceLabel = requestedLabel || `space-${number}`;
        const pane = {
          paneId,
          workspaceId,
          workspaceLabel,
          tabId,
          cwd: requestedCwd || "/demo",
        };
        demoOutputs.current[paneId] = {
          paneId,
          text: `\u001b[1;36m${workspaceLabel}\u001b[0m\r\n$ `,
          truncated: false,
          revision: 1,
        };
        setSnapshot((current) => ({
          ...current,
          workspaces: [
            ...current.workspaces,
            {
              workspaceId,
              number,
              label: workspaceLabel,
              focused: false,
              activeTabId: tabId,
              tabCount: 1,
              paneCount: 1,
            },
          ],
          tabs: [
            ...current.tabs,
            {
              tabId,
              workspaceId,
              number: 1,
              label: "shell",
              focused: false,
              paneCount: 1,
            },
          ],
          shellPanes: [
            ...current.shellPanes,
            {
              ...pane,
              workspaceNumber: number,
              agent: "shell",
              status: "idle",
              focused: false,
              kind: "shell",
            },
          ],
          ts: Date.now(),
        }));
        return { ok: true, pane };
      }

      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const result = await transport.createWorkspace(request);
      if (result.ok) {
        setSnapshot((current) => {
          const workspacePresent = current.workspaces.some(
            (workspace) => workspace.workspaceId === result.pane.workspaceId,
          );
          const tabPresent = current.tabs.some((tab) => tab.tabId === result.pane.tabId);
          const panePresent = [...current.agents, ...current.shellPanes].some(
            (pane) => pane.paneId === result.pane.paneId,
          );
          return {
            ...current,
            workspaces: workspacePresent
              ? current.workspaces
              : [
                  ...current.workspaces,
                  {
                    workspaceId: result.pane.workspaceId,
                    number,
                    label: result.pane.workspaceLabel,
                    focused: false,
                    activeTabId: result.pane.tabId,
                    tabCount: 1,
                    paneCount: 1,
                  },
                ],
            tabs: tabPresent
              ? current.tabs
              : [
                  ...current.tabs,
                  {
                    tabId: result.pane.tabId,
                    workspaceId: result.pane.workspaceId,
                    number: 1,
                    label: "shell",
                    focused: false,
                    paneCount: 1,
                  },
                ],
            shellPanes: panePresent
              ? current.shellPanes
              : [
                  ...current.shellPanes,
                  {
                    ...result.pane,
                    workspaceNumber: number,
                    agent: "shell",
                    status: "idle",
                    focused: false,
                    kind: "shell",
                  },
                ],
            ts: Date.now(),
          };
        });
        void refresh();
      } else if (result.deliveryAmbiguous) {
        void refresh();
      }
      return result;
    },
    [mode, refresh, snapshot.workspaces, transport],
  );

  const renameTab = useCallback(
    async (tabId: string, label: string): Promise<ActionResponse> => {
      const normalized = label.trim();
      if (!normalized) return { ok: false, error: "Enter a tab name." };
      if (mode === "demo") {
        const exists = snapshot.tabs.some((tab) => tab.tabId === tabId);
        if (!exists) return { ok: false, error: "Tab not found." };
        setSnapshot((current) => ({
          ...current,
          tabs: current.tabs.map((tab) =>
            tab.tabId === tabId ? { ...tab, label: normalized } : tab,
          ),
          ts: Date.now(),
        }));
        return { ok: true };
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const result = await transport.renameTab(tabId, normalized);
      if (result.ok) {
        setSnapshot((current) => ({
          ...current,
          tabs: current.tabs.map((tab) =>
            tab.tabId === tabId ? { ...tab, label: normalized } : tab,
          ),
          ts: Date.now(),
        }));
        void refresh();
      }
      return result;
    },
    [mode, refresh, snapshot.tabs, transport],
  );

  const createWorktree = useCallback(
    async (request: CreateWorktreeRequest): Promise<WorktreeCreateResponse> => {
      if (mode === "demo") {
        const source = snapshot.workspaces.find(
          (workspace) => workspace.workspaceId === request.workspaceId,
        );
        if (!source?.worktree) return { ok: false, error: "Select a git workspace." };
        const suffix = request.branch?.trim() || `worktree-${snapshot.workspaces.length + 1}`;
        const workspaceId = `demo-worktree-${Date.now()}`;
        const tabId = `${workspaceId}:t1`;
        const paneId = `${workspaceId}:p1`;
        const workspace = {
          workspaceId,
          number: Math.max(0, ...snapshot.workspaces.map((item) => item.number)) + 1,
          label: request.label?.trim() || suffix,
          focused: false,
          activeTabId: tabId,
          tabCount: 1,
          paneCount: 1,
          worktree: {
            ...source.worktree,
            checkoutPath: `${source.worktree.repoRoot}/.herdr/${suffix}`,
            isLinkedWorktree: true,
          },
        };
        const tab = {
          tabId,
          workspaceId,
          number: 1,
          label: "shell",
          focused: true,
          paneCount: 1,
        };
        const pane = {
          paneId,
          workspaceId,
          workspaceLabel: workspace.label,
          tabId,
          cwd: workspace.worktree.checkoutPath,
        };
        demoOutputs.current[paneId] = {
          paneId,
          text: `\u001b[1;36m${workspace.label}\u001b[0m\r\n$ `,
          truncated: false,
          revision: 1,
        };
        setSnapshot((current) => ({
          ...current,
          workspaces: [...current.workspaces, workspace],
          tabs: [...current.tabs, tab],
          shellPanes: [
            ...current.shellPanes,
            {
              ...pane,
              workspaceNumber: workspace.number,
              agent: "shell",
              status: "idle",
              focused: false,
              kind: "shell",
            },
          ],
          ts: Date.now(),
        }));
        return { ok: true, workspace, tab, pane };
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const result = await transport.createWorktree(request);
      if (result.ok) {
        setSnapshot((current) => ({
          ...current,
          workspaces: [
            ...current.workspaces.filter(
              (workspace) => workspace.workspaceId !== result.workspace.workspaceId,
            ),
            result.workspace,
          ].sort((left, right) => left.number - right.number),
          tabs: [
            ...current.tabs.filter((tab) => tab.tabId !== result.tab.tabId),
            result.tab,
          ],
          shellPanes: [
            ...current.shellPanes.filter((pane) => pane.paneId !== result.pane.paneId),
            {
              ...result.pane,
              workspaceNumber: result.workspace.number,
              agent: "shell",
              status: "idle",
              focused: false,
              kind: "shell",
            },
          ],
          ts: Date.now(),
        }));
        void refresh();
      }
      return result;
    },
    [mode, refresh, snapshot.workspaces, transport],
  );

  const removeWorktree = useCallback(
    async (workspaceId: string, force: boolean, requestId: string): Promise<ActionResponse> => {
      if (mode === "demo") {
        const paneIds = new Set(
          [...snapshot.agents, ...snapshot.shellPanes]
            .filter((pane) => pane.workspaceId === workspaceId)
            .map((pane) => pane.paneId),
        );
        for (const paneId of paneIds) delete demoOutputs.current[paneId];
        setSnapshot((current) => ({
          ...current,
          workspaces: current.workspaces.filter(
            (workspace) => workspace.workspaceId !== workspaceId,
          ),
          tabs: current.tabs.filter((tab) => tab.workspaceId !== workspaceId),
          agents: current.agents.filter((pane) => pane.workspaceId !== workspaceId),
          shellPanes: current.shellPanes.filter((pane) => pane.workspaceId !== workspaceId),
          ts: Date.now(),
        }));
        return { ok: true };
      }
      if (!transport) throw new Error("Connect to a Herdr bridge first.");
      const result = await transport.removeWorktree(workspaceId, force, requestId);
      if (result.ok) {
        setSnapshot((current) => ({
          ...current,
          workspaces: current.workspaces.filter(
            (workspace) => workspace.workspaceId !== workspaceId,
          ),
          tabs: current.tabs.filter((tab) => tab.workspaceId !== workspaceId),
          agents: current.agents.filter((pane) => pane.workspaceId !== workspaceId),
          shellPanes: current.shellPanes.filter((pane) => pane.workspaceId !== workspaceId),
          ts: Date.now(),
        }));
        void refresh();
      }
      return result;
    },
    [mode, refresh, snapshot.agents, snapshot.shellPanes, transport],
  );

  return {
    config,
    mode,
    snapshot,
    error,
    connect,
    useDemo,
    refresh,
    readPane,
    sendReply,
    sendInput,
    focusPane,
    scrollPane,
    subscribePaneOutput,
    liveSourceConnected,
    paneStreamConnected,
    createTab,
    createWorkspace,
    renameTab,
    createWorktree,
    removeWorktree,
  };
}

export function usePaneOutput(
  paneId: string | undefined,
  mode: ConnectionMode,
  contextKey: string,
  readPane: (paneId: string, signal?: AbortSignal) => Promise<PaneReadResponse>,
  subscribePaneOutput: (
    paneId: string,
    size: TerminalGridSize,
    listener: (event: PaneLiveUpdate) => void,
  ) => () => void,
  paneStreamConnected: boolean,
  terminalSize: TerminalGridSize | null,
) {
  const [output, setOutput] = useState<PaneReadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectionKey = `${contextKey}\n${paneId ?? ""}`;
  const selectionKeyRef = useRef("");
  const paneStreamConnectedRef = useRef(paneStreamConnected);

  useEffect(() => {
    paneStreamConnectedRef.current = paneStreamConnected;
  }, [paneStreamConnected]);

  useEffect(() => {
    if (!paneId || !terminalSize || mode === "unconfigured" || mode === "connecting") {
      setOutput(null);
      setLoading(false);
      setError(null);
      selectionKeyRef.current = selectionKey;
      return;
    }
    const controller = new AbortController();
    if (selectionKeyRef.current !== selectionKey) setOutput(null);
    selectionKeyRef.current = selectionKey;
    paneStreamConnectedRef.current = false;
    setError(null);
    let inFlight = false;
    let queued = false;
    let eventTimer: ReturnType<typeof setTimeout> | null = null;
    let frameTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingFrameText = "";
    let pendingFrameSeq = 0;
    const flushFrame = () => {
      frameTimer = null;
      const text = pendingFrameText;
      const revision = pendingFrameSeq;
      pendingFrameText = "";
      pendingFrameSeq = 0;
      if (!text || controller.signal.aborted) return;
      setOutput((current) => {
        if (current?.paneId !== paneId) return current;
        return {
          ...current,
          text: current.text + text,
          revision,
        };
      });
    };
    const load = async () => {
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      setLoading(true);
      try {
        const next = await readPane(paneId, controller.signal);
        if (controller.signal.aborted) return;
        if (next.paneId !== paneId) throw new Error("Pane response did not match the selected pane.");
        setOutput(next);
        setError(null);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Pane read failed.");
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
        if (queued && !controller.signal.aborted) {
          queued = false;
          void load();
        }
      }
    };
    const unsubscribe = subscribePaneOutput(paneId, terminalSize, (event) => {
      if (event.type === "pane_frame") {
        paneStreamConnectedRef.current = true;
        if (event.full) {
          if (frameTimer) clearTimeout(frameTimer);
          frameTimer = null;
          pendingFrameText = "";
          pendingFrameSeq = 0;
          setOutput({
            paneId,
            text: event.text,
            truncated: false,
            revision: event.seq,
          });
        } else {
          pendingFrameText += event.text;
          pendingFrameSeq = event.seq;
          if (!frameTimer) frameTimer = setTimeout(flushFrame, 16);
        }
        setLoading(false);
        setError(null);
        return;
      }
      if (eventTimer) return;
      eventTimer = setTimeout(() => {
        eventTimer = null;
        void load();
      }, 32);
    });
    // The native frame stream is authoritative. A bounded REST read only starts if no frame arrives
    // promptly (older Herdr, reconnect, or observer failure), avoiding a visible REST→TUI replay.
    const fallback = setTimeout(
      () => {
        if (!paneStreamConnectedRef.current) void load();
      },
      mode === "live" ? 900 : 0,
    );
    const timer = setInterval(() => {
      if (!paneStreamConnectedRef.current) void load();
    }, mode === "live" ? 1_600 : 5_000);
    return () => {
      controller.abort();
      unsubscribe();
      if (eventTimer) clearTimeout(eventTimer);
      if (frameTimer) clearTimeout(frameTimer);
      clearTimeout(fallback);
      clearInterval(timer);
    };
  }, [mode, paneId, readPane, selectionKey, subscribePaneOutput, terminalSize]);

  const selectionIsCurrent = selectionKeyRef.current === selectionKey;
  return {
    output: selectionIsCurrent ? output : null,
    setOutput,
    loading,
    error: selectionIsCurrent ? error : null,
  };
}
