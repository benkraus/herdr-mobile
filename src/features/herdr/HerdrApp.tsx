import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { AppText as Text, AppTextInput } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { ControlPillMenu } from "../../components/ControlPill";
import { ErrorBanner } from "../../components/ErrorBanner";
import { GlassSafeAreaView } from "../../components/GlassSafeAreaView";
import { LoadingStrip } from "../../components/LoadingStrip";
import { StatusPill } from "../../components/StatusPill";
import { TerminalSurface } from "../terminal/NativeTerminalSurface";
import { useHerdrConnection, usePaneOutput } from "../../hooks/useHerdrConnection";
import { pickComposerImages } from "../../lib/composerImages";
import {
  allPanes,
  defaultSpace,
  defaultTab,
  focusedSelection,
  groupWorkspaces,
  paneForTab,
  tabsForSpace,
} from "../../lib/model";
import type {
  AgentStatus,
  AgentView,
  ConnectionConfig,
  PaneReadResponse,
  TabView,
  WorkspaceView,
} from "../../lib/types";
import { useThemeColor } from "../../lib/useThemeColor";
import { uuidv4 } from "../../lib/uuid";
import { isHerdrUploadMimeType, stageAndPasteHerdrImages } from "./imageAttachments";

const SPLIT_MIN_WIDTH = 760;
const SIDEBAR_WIDTH = 340;
const ANDROID_SYSTEM_BAR_FLOOR = 48;

function safeBottomInset(bottom: number): number {
  return Platform.OS === "android" ? Math.max(bottom, ANDROID_SYSTEM_BAR_FLOOR) : bottom;
}

const STATUS_TONES: Record<AgentStatus, Parameters<typeof StatusPill>[0]> = {
  blocked: {
    label: "Needs input",
    pillClassName: "bg-amber-500/14",
    textClassName: "text-amber-700 dark:text-amber-300",
  },
  working: {
    label: "Working",
    pillClassName: "bg-blue-500/14",
    textClassName: "text-blue-700 dark:text-blue-300",
  },
  done: {
    label: "Done",
    pillClassName: "bg-emerald-500/14",
    textClassName: "text-emerald-700 dark:text-emerald-300",
  },
  idle: {
    label: "Idle",
    pillClassName: "bg-subtle-strong",
    textClassName: "text-foreground-secondary",
  },
  unknown: {
    label: "Unknown",
    pillClassName: "bg-subtle-strong",
    textClassName: "text-foreground-muted",
  },
};

function mostUrgent(panes: AgentView[]): AgentStatus {
  return (
    panes.find((pane) => pane.status === "blocked")?.status ??
    panes.find((pane) => pane.status === "working")?.status ??
    panes.find((pane) => pane.status === "unknown")?.status ??
    panes.find((pane) => pane.status === "idle")?.status ??
    panes.find((pane) => pane.status === "done")?.status ??
    "idle"
  );
}

function statusDotClass(status: AgentStatus): string {
  if (status === "blocked") return "bg-amber-500";
  if (status === "working") return "bg-blue-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-foreground-tertiary";
}

function displayPane(pane: AgentView | undefined): string {
  if (!pane || pane.kind === "shell") return "Shell";
  return pane.agent.charAt(0).toUpperCase() + pane.agent.slice(1);
}

function Navigator(props: {
  snapshot: ReturnType<typeof useHerdrConnection>["snapshot"];
  mode: ReturnType<typeof useHerdrConnection>["mode"];
  selectedWorkspaceId?: string;
  selectedPaneId?: string;
  compact: boolean;
  canWrite: boolean;
  creatingTabWorkspaceId?: string;
  onClose: () => void;
  onSelectSpace: (workspaceId: string) => void;
  onSelectPane: (paneId: string) => void;
  onCreateSpace: () => void;
  onCreateTab: (workspace: WorkspaceView) => Promise<void>;
  onCreateWorktree: (workspace: WorkspaceView) => void;
  onRemoveWorktree: (workspace: WorkspaceView) => void;
  onOpenConnection: () => void;
}) {
  const insets = useSafeAreaInsets();
  const borderColor = useThemeColor("--color-border");
  const iconColor = useThemeColor("--color-icon");
  const mutedIcon = useThemeColor("--color-icon-muted");
  const panes = allPanes(props.snapshot);
  const groups = groupWorkspaces(props.snapshot);
  const bottomInset = safeBottomInset(insets.bottom);
  const [section, setSection] = useState<"spaces" | "agents">("spaces");

  const renderWorkspace = (workspace: WorkspaceView, linked: boolean) => {
    const workspacePanes = panes.filter((pane) => pane.workspaceId === workspace.workspaceId);
    const status = mostUrgent(workspacePanes);
    const selected = workspace.workspaceId === props.selectedWorkspaceId;
    const creatingTab = props.creatingTabWorkspaceId === workspace.workspaceId;
    const actions = [
      {
        id: "new-shell-tab",
        title: "New shell tab",
        image: "terminal",
        attributes: { disabled: !props.canWrite || creatingTab },
      },
      ...(!linked && workspace.worktree
        ? [
            {
              id: "new-worktree",
              title: "New worktree",
              image: "arrow.triangle.branch",
              attributes: { disabled: !props.canWrite },
            },
          ]
        : []),
      ...(linked
        ? [
            {
              id: "remove-worktree",
              title: "Remove worktree",
              image: "trash",
              attributes: { disabled: !props.canWrite, destructive: true },
            },
          ]
        : []),
    ];
    return (
      <View
        key={workspace.workspaceId}
        className={linked ? "ml-4 border-l border-border-subtle" : ""}
      >
        <View className="mr-2 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${linked ? "Worktree" : "Workspace"} ${workspace.label}`}
            onPress={() => props.onSelectSpace(workspace.workspaceId)}
            className={`min-h-14 min-w-0 flex-1 flex-row items-center gap-2.5 rounded-xl py-2.5 active:opacity-65 ${
              linked ? "ml-2 pl-3" : "ml-2 pl-3"
            } ${selected ? "bg-subtle" : ""}`}
          >
            <SymbolView
              name={linked ? "arrow.triangle.branch" : "folder.fill"}
              size={linked ? 15 : 17}
              tintColor={mutedIcon}
              type="monochrome"
            />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-t3-bold" numberOfLines={1}>
                {workspace.label}
              </Text>
              <Text className="mt-0.5 text-3xs text-foreground-muted" numberOfLines={1}>
                {linked
                  ? workspace.worktree?.checkoutPath
                  : (workspace.worktree?.repoRoot ?? `${workspace.tabCount} tabs`)}
              </Text>
            </View>
            <View className={`h-2 w-2 rounded-full ${statusDotClass(status)}`} />
          </Pressable>
          {selected ? (
            <ControlPillMenu
              actions={actions}
              title={workspace.label}
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === "new-shell-tab") void props.onCreateTab(workspace);
                else if (nativeEvent.event === "new-worktree") props.onCreateWorktree(workspace);
                else if (nativeEvent.event === "remove-worktree") props.onRemoveWorktree(workspace);
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${linked ? "worktree" : "space"} ${workspace.label}`}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-subtle"
              >
                {creatingTab ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <SymbolView name="ellipsis" size={17} tintColor={iconColor} type="monochrome" />
                )}
              </Pressable>
            </ControlPillMenu>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View
      className="flex-1 bg-drawer"
      style={{
        paddingTop: insets.top,
        paddingBottom: bottomInset,
        borderRightColor: borderColor,
        borderRightWidth: 1,
      }}
    >
      <View className="h-18 flex-row items-center gap-2 px-5">
        <Text className="flex-1 text-xl font-t3-extrabold">Herdr</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New space"
          disabled={!props.canWrite}
          onPress={props.onCreateSpace}
          className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-65 disabled:opacity-35"
        >
          <SymbolView name="plus" size={18} tintColor={iconColor} type="monochrome" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connection settings"
          onPress={props.onOpenConnection}
          className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-65"
        >
          <SymbolView name="gearshape" size={18} tintColor={iconColor} type="monochrome" />
        </Pressable>
        {props.compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigator"
            onPress={props.onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-65"
          >
            <SymbolView name="xmark" size={17} tintColor={iconColor} type="monochrome" />
          </Pressable>
        ) : null}
      </View>

      <View
        accessibilityRole="tablist"
        className="h-13 flex-row border-b border-border-subtle px-3"
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Spaces and worktrees"
          accessibilityState={{ selected: section === "spaces" }}
          onPress={() => setSection("spaces")}
          className={`min-w-0 flex-1 flex-row items-center justify-center gap-2 border-b-2 px-2 ${
            section === "spaces" ? "border-foreground" : "border-transparent"
          }`}
        >
          <Text
            className={`text-xs font-t3-bold ${section === "spaces" ? "text-foreground" : "text-foreground-muted"}`}
          >
            Spaces
          </Text>
          <Text className="text-3xs text-foreground-tertiary">
            {props.snapshot.workspaces.length}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Agents"
          accessibilityState={{ selected: section === "agents" }}
          onPress={() => setSection("agents")}
          className={`min-w-0 flex-1 flex-row items-center justify-center gap-2 border-b-2 px-2 ${
            section === "agents" ? "border-foreground" : "border-transparent"
          }`}
        >
          <Text
            className={`text-xs font-t3-bold ${section === "agents" ? "text-foreground" : "text-foreground-muted"}`}
          >
            Agents
          </Text>
          <Text className="text-3xs text-foreground-tertiary">{props.snapshot.agents.length}</Text>
        </Pressable>
      </View>
      {section === "spaces" ? (
        <ScrollView contentContainerClassName="gap-2 py-3" showsVerticalScrollIndicator={false}>
          {groups.map((group) => (
            <View key={group.key} className="gap-1">
              {group.parent ? (
                renderWorkspace(group.parent, false)
              ) : (
                <Text className="px-5 pt-2 text-sm font-t3-bold text-foreground-muted">
                  {group.title}
                </Text>
              )}
              {group.worktrees.map((workspace) => renderWorkspace(workspace, true))}
            </View>
          ))}
          {groups.length === 0 ? (
            <Text className="px-5 py-4 text-sm text-foreground-muted">
              No Herdr workspaces found.
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerClassName="gap-1 px-3 py-3"
          showsVerticalScrollIndicator={false}
        >
          {props.snapshot.agents.map((agent) => {
            const selected = agent.paneId === props.selectedPaneId;
            return (
              <Pressable
                key={agent.paneId}
                accessibilityRole="button"
                accessibilityLabel={`${displayPane(agent)} agent in ${agent.workspaceLabel}`}
                accessibilityState={{ selected }}
                onPress={() => props.onSelectPane(agent.paneId)}
                className={`min-h-17 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-65 ${
                  selected ? "bg-subtle" : ""
                }`}
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-subtle-strong">
                  <SymbolView name="terminal" size={16} tintColor={mutedIcon} type="monochrome" />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="min-w-0 flex-1 text-sm font-t3-extrabold" numberOfLines={1}>
                      {displayPane(agent)}
                    </Text>
                    <View className={`h-2 w-2 rounded-full ${statusDotClass(agent.status)}`} />
                  </View>
                  <Text className="mt-0.5 text-3xs text-foreground-muted" numberOfLines={1}>
                    {agent.workspaceLabel} · {STATUS_TONES[agent.status].label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {props.snapshot.agents.length === 0 ? (
            <View className="px-2 py-6">
              <Text className="text-sm font-t3-bold">No agents running</Text>
              <Text className="mt-1 text-xs text-foreground-muted">
                Agents appear here when they are attached to a Herdr pane.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={props.onOpenConnection}
        className="min-h-16 flex-row items-center gap-3 border-t border-border px-5 active:opacity-65"
      >
        <View
          className={`h-2 w-2 rounded-full ${props.mode === "live" || props.mode === "demo" ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        <Text className="flex-1 text-sm font-t3-medium">Connection</Text>
        <Text className="text-2xs capitalize text-foreground-muted">{props.mode}</Text>
        <SymbolView name="chevron.right" size={14} tintColor={iconColor} type="monochrome" />
      </Pressable>
    </View>
  );
}

function SheetHeader(props: { title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor("--color-icon");
  return (
    <View
      className="flex-row items-center border-b border-border px-5"
      style={{
        minHeight: insets.top + 72,
        paddingTop: insets.top + 12,
        paddingBottom: 12,
      }}
    >
      <Text className="flex-1 text-lg font-t3-extrabold">{props.title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={props.onClose}
        className="h-10 w-10 items-center justify-center rounded-full bg-subtle"
      >
        <SymbolView name="xmark" size={17} tintColor={iconColor} type="monochrome" />
      </Pressable>
    </View>
  );
}

function ConnectionSheet(props: {
  visible: boolean;
  initial: ConnectionConfig | null;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  onDemo: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(props.initial?.baseUrl ?? "");
  const [session, setSession] = useState(props.initial?.session ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.visible) return;
    setUrl(props.initial?.baseUrl ?? "");
    setSession(props.initial?.session ?? "");
    setError(null);
  }, [props.initial, props.visible]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const sessionName = session.trim();
      await props.onConnect({ baseUrl: url, ...(sessionName ? { session: sessionName } : {}) });
      props.onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  };

  const bottomInset = safeBottomInset(insets.bottom);
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View className="flex-1 bg-screen" style={{ paddingBottom: bottomInset }}>
        <SheetHeader title="Connect to Herdr" onClose={props.onClose} />
        <ScrollView contentContainerClassName="gap-5 px-5 py-7" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
              Bridge URL
            </Text>
            <AppTextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://machine.tailnet.ts.net:8787"
            />
          </View>
          <View>
            <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
              Session (optional)
            </Text>
            <AppTextInput
              value={session}
              onChangeText={setSession}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="primary"
            />
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !url.trim()}
            onPress={() => void connect()}
            className="h-13 items-center justify-center rounded-full bg-primary active:opacity-70 disabled:opacity-40"
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-t3-bold text-primary-foreground">Connect</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void props.onDemo().then(props.onClose)}
            className="h-13 items-center justify-center rounded-full bg-subtle active:opacity-70"
          >
            <Text className="font-t3-bold">Use preview data</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function WorkspaceCreateSheet(props: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: { label?: string; cwd?: string }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState("");
  const [cwd, setCwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.visible) return;
    setLabel("");
    setCwd("");
    setError(null);
  }, [props.visible]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await props.onCreate({
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Space could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const bottomInset = safeBottomInset(insets.bottom);
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView automaticOffset behavior="padding" className="flex-1 bg-screen">
        <View className="flex-1" style={{ paddingBottom: bottomInset }}>
          <SheetHeader title="New space" onClose={props.onClose} />
          <ScrollView
            contentContainerClassName="gap-5 px-5 py-7"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
                Name (optional)
              </Text>
              <AppTextInput
                accessibilityLabel="Space name"
                value={label}
                onChangeText={setLabel}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={128}
                placeholder="Let Herdr choose a name"
              />
            </View>
            <View>
              <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
                Working directory (optional)
              </Text>
              <AppTextInput
                accessibilityLabel="Space working directory"
                value={cwd}
                onChangeText={setCwd}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Defaults to the host home directory"
                returnKeyType="done"
                onSubmitEditing={() => void create()}
              />
            </View>
            <Text className="text-xs leading-5 text-foreground-muted">
              Herdr creates a durable space with its first shell tab ready to use.
            </Text>
            {error ? <ErrorBanner message={error} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create space"
              disabled={busy}
              onPress={() => void create()}
              className="h-13 items-center justify-center rounded-full bg-primary active:opacity-70 disabled:opacity-40"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-t3-bold text-primary-foreground">Create space</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WorktreeCreateSheet(props: {
  workspace: WorkspaceView | null;
  onClose: () => void;
  onCreate: (input: { branch?: string; base?: string; label?: string }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [branch, setBranch] = useState("");
  const [base, setBase] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.workspace) return;
    setBranch("");
    setBase("");
    setLabel("");
    setError(null);
  }, [props.workspace]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await props.onCreate({
        ...(branch.trim() ? { branch: branch.trim() } : {}),
        ...(base.trim() ? { base: base.trim() } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worktree could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const bottomInset = safeBottomInset(insets.bottom);
  return (
    <Modal
      visible={props.workspace !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View className="flex-1 bg-screen" style={{ paddingBottom: bottomInset }}>
        <SheetHeader
          title={`New worktree · ${props.workspace?.label ?? ""}`}
          onClose={props.onClose}
        />
        <ScrollView contentContainerClassName="gap-5 px-5 py-7" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
              Branch
            </Text>
            <AppTextInput
              value={branch}
              onChangeText={setBranch}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Let Herdr choose a branch name"
            />
          </View>
          <View>
            <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
              Base ref (optional)
            </Text>
            <AppTextInput
              value={base}
              onChangeText={setBase}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Current HEAD"
            />
          </View>
          <View>
            <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
              Label (optional)
            </Text>
            <AppTextInput
              value={label}
              onChangeText={setLabel}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Uses the branch name"
            />
          </View>
          <Text className="text-xs leading-5 text-foreground-muted">
            Herdr creates the linked checkout and opens its first terminal tab beneath this
            repository.
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void create()}
            className="h-13 items-center justify-center rounded-full bg-primary active:opacity-70 disabled:opacity-40"
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-t3-bold text-primary-foreground">Create worktree</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function WorktreeRemoveSheet(props: {
  workspace: WorkspaceView | null;
  onClose: () => void;
  onRemove: (force: boolean) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [props.workspace]);

  const remove = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await props.onRemove(force);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worktree could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  const bottomInset = safeBottomInset(insets.bottom);
  return (
    <Modal
      visible={props.workspace !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View className="flex-1 bg-screen" style={{ paddingBottom: bottomInset }}>
        <SheetHeader title="Remove worktree" onClose={props.onClose} />
        <View className="flex-1 gap-5 px-5 py-7">
          <Text className="text-base leading-6">
            Remove the <Text className="font-t3-bold">{props.workspace?.label}</Text> workspace and
            delete its linked checkout?
          </Text>
          <Text className="text-xs leading-5 text-foreground-muted" selectable>
            {props.workspace?.worktree?.checkoutPath}
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
          <View className="mt-auto gap-3">
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void remove(false)}
              className="h-13 items-center justify-center rounded-full bg-red-600 active:opacity-70 disabled:opacity-40"
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-t3-bold text-white">Remove checkout</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void remove(true)}
              className="h-13 items-center justify-center rounded-full bg-subtle active:opacity-70 disabled:opacity-40"
            >
              <Text className="font-t3-bold text-red-600">Force remove with local changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TabRenameSheet(props: {
  tab: TabView | null;
  onClose: () => void;
  onRename: (label: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.tab) return;
    setLabel(props.tab.label);
    setError(null);
  }, [props.tab]);

  const rename = async () => {
    const normalized = label.trim();
    if (!normalized) return;
    setBusy(true);
    setError(null);
    try {
      await props.onRename(normalized);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tab could not be renamed.");
    } finally {
      setBusy(false);
    }
  };

  const bottomInset = safeBottomInset(insets.bottom);
  return (
    <Modal
      visible={props.tab !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView automaticOffset behavior="padding" className="flex-1 bg-screen">
        <View className="flex-1" style={{ paddingBottom: bottomInset }}>
          <SheetHeader title="Rename tab" onClose={props.onClose} />
          <View className="flex-1 gap-5 px-5 py-7">
            <View>
              <Text className="mb-2 text-2xs font-t3-bold uppercase tracking-wider text-foreground-muted">
                Tab name
              </Text>
              <AppTextInput
                accessibilityLabel="Tab name"
                value={label}
                onChangeText={setLabel}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={128}
                returnKeyType="done"
                onSubmitEditing={() => void rename()}
              />
            </View>
            {error ? <ErrorBanner message={error} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save tab name"
              disabled={busy || !label.trim()}
              onPress={() => void rename()}
              className="h-13 items-center justify-center rounded-full bg-primary active:opacity-70 disabled:opacity-40"
            >
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-t3-bold text-primary-foreground">Rename tab</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function HerdrApp() {
  const { width } = useWindowDimensions();
  const compact = width < SPLIT_MIN_WIDTH;
  const insets = useSafeAreaInsets();
  const bottomInset = safeBottomInset(insets.bottom);
  const herdr = useHerdrConnection();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [spaceCreateOpen, setSpaceCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<WorkspaceView | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceView | null>(null);
  const [renameTarget, setRenameTarget] = useState<TabView | null>(null);
  const [creatingTabWorkspaceId, setCreatingTabWorkspaceId] = useState<string>();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [selectedTabId, setSelectedTabId] = useState<string>();
  const [selectedPaneId, setSelectedPaneId] = useState<string>();
  const [terminalSize, setTerminalSize] = useState<{ cols: number; rows: number } | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [imageUploadPaneId, setImageUploadPaneId] = useState<string>();
  const terminalOutputCache = useRef(new Map<string, PaneReadResponse>());
  const [presentedTerminal, setPresentedTerminal] = useState<{
    connectionKey: string;
    paneId: string;
  }>();
  const pendingFocusPaneId = useRef<string | undefined>(undefined);
  const pendingFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panes = useMemo(() => allPanes(herdr.snapshot), [herdr.snapshot]);
  const selectedSpace = herdr.snapshot.workspaces.find(
    (space) => space.workspaceId === selectedWorkspaceId,
  );
  const tabs = selectedWorkspaceId ? tabsForSpace(herdr.snapshot, selectedWorkspaceId) : [];
  const selectedPane = panes.find((pane) => pane.paneId === selectedPaneId);
  const connectionKey =
    herdr.mode === "demo"
      ? "demo"
      : `${herdr.config?.baseUrl ?? "none"}\n${herdr.config?.session ?? "primary"}`;
  const paneState = usePaneOutput(
    selectedPaneId,
    herdr.mode,
    connectionKey,
    herdr.readPane,
    herdr.subscribePaneOutput,
    herdr.paneStreamConnected,
    terminalSize,
  );
  const presentedCacheKey = presentedTerminal
    ? `${presentedTerminal.connectionKey}\n${presentedTerminal.paneId}`
    : null;
  const selectedOutputReady = paneState.output?.paneId === selectedPaneId;
  const presentedOutput =
    selectedOutputReady && presentedTerminal?.paneId === selectedPaneId
      ? paneState.output
      : presentedCacheKey
        ? (terminalOutputCache.current.get(presentedCacheKey) ?? null)
        : null;
  const presentedPaneId =
    presentedTerminal?.connectionKey === connectionKey ? presentedTerminal.paneId : undefined;
  const readOnly = Boolean(herdr.snapshot.device?.enforced && !herdr.snapshot.device.authorized);
  const canWrite = !readOnly && (herdr.mode === "live" || herdr.mode === "demo");
  const iconColor = useThemeColor("--color-icon");
  const mutedIcon = useThemeColor("--color-icon-muted");

  useEffect(() => {
    if (herdr.mode === "unconfigured") setConnectionOpen(true);
  }, [herdr.mode]);

  useEffect(() => {
    terminalOutputCache.current.clear();
    setPresentedTerminal(undefined);
  }, [connectionKey]);

  useEffect(() => {
    if (!selectedPaneId || paneState.output?.paneId !== selectedPaneId) return;
    terminalOutputCache.current.set(`${connectionKey}\n${selectedPaneId}`, paneState.output);
    if (
      presentedTerminal?.connectionKey !== connectionKey ||
      presentedTerminal.paneId !== selectedPaneId
    ) {
      setPresentedTerminal({ connectionKey, paneId: selectedPaneId });
    }
  }, [connectionKey, paneState.output, presentedTerminal, selectedPaneId]);

  useEffect(() => {
    const focused = focusedSelection(herdr.snapshot);
    let pendingPane = panes.find((pane) => pane.paneId === pendingFocusPaneId.current);
    if (pendingFocusPaneId.current && !pendingPane) pendingFocusPaneId.current = undefined;
    if (pendingPane?.paneId === focused.paneId) {
      pendingFocusPaneId.current = undefined;
      if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
      pendingFocusTimer.current = null;
      pendingPane = undefined;
    }
    const currentSpace = herdr.snapshot.workspaces.find(
      (space) => space.workspaceId === selectedWorkspaceId,
    );
    const space = pendingPane
      ? herdr.snapshot.workspaces.find(
          (candidate) => candidate.workspaceId === pendingPane.workspaceId,
        )
      : (herdr.snapshot.workspaces.find(
          (candidate) => candidate.workspaceId === focused.workspaceId,
        ) ??
        currentSpace ??
        defaultSpace(herdr.snapshot));
    if (!space) {
      setSelectedWorkspaceId(undefined);
      setSelectedTabId(undefined);
      setSelectedPaneId(undefined);
      return;
    }
    const scopedTabs = tabsForSpace(herdr.snapshot, space.workspaceId);
    const tab =
      (pendingPane ? scopedTabs.find((item) => item.tabId === pendingPane.tabId) : undefined) ??
      scopedTabs.find((item) => item.tabId === focused.tabId) ??
      scopedTabs.find((item) => item.tabId === selectedTabId) ??
      defaultTab(herdr.snapshot, space.workspaceId);
    const pane =
      (pendingPane?.tabId === tab?.tabId ? pendingPane : undefined) ??
      panes.find((item) => item.paneId === focused.paneId && item.tabId === tab?.tabId) ??
      panes.find((item) => item.paneId === selectedPaneId && item.tabId === tab?.tabId) ??
      (tab ? paneForTab(herdr.snapshot, tab.tabId) : undefined);
    setSelectedWorkspaceId(space.workspaceId);
    setSelectedTabId(tab?.tabId);
    setSelectedPaneId(pane?.paneId);
  }, [herdr.snapshot, panes, selectedPaneId, selectedTabId, selectedWorkspaceId]);

  useEffect(
    () => () => {
      if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
    },
    [],
  );

  useEffect(() => setTerminalError(null), [selectedPaneId]);

  const selectPane = useCallback(
    (paneId: string) => {
      const pane = panes.find((candidate) => candidate.paneId === paneId);
      if (!pane) return;
      setSelectedWorkspaceId(pane.workspaceId);
      setSelectedTabId(pane.tabId);
      setSelectedPaneId(pane.paneId);
      setDrawerOpen(false);
      setTerminalError(null);
      pendingFocusPaneId.current = pane.paneId;
      if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
      pendingFocusTimer.current = setTimeout(() => {
        if (pendingFocusPaneId.current !== pane.paneId) return;
        pendingFocusPaneId.current = undefined;
        pendingFocusTimer.current = null;
        void herdr.refresh();
      }, 2_500);
      void herdr
        .focusPane(pane.paneId)
        .then((result) => {
          if (!result.ok) {
            if (pendingFocusPaneId.current === pane.paneId) pendingFocusPaneId.current = undefined;
            if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
            pendingFocusTimer.current = null;
            if (!result.cancelled) setTerminalError(result.error);
          }
        })
        .catch((reason: unknown) => {
          if (pendingFocusPaneId.current === pane.paneId) pendingFocusPaneId.current = undefined;
          if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
          pendingFocusTimer.current = null;
          setTerminalError(reason instanceof Error ? reason.message : "Pane focus failed.");
        });
    },
    [herdr, panes],
  );

  const selectSpace = useCallback(
    (workspaceId: string) => {
      const tab = defaultTab(herdr.snapshot, workspaceId);
      const pane = tab ? paneForTab(herdr.snapshot, tab.tabId) : undefined;
      if (pane) {
        selectPane(pane.paneId);
        return;
      }
      setSelectedWorkspaceId(workspaceId);
      setSelectedTabId(tab?.tabId);
      setSelectedPaneId(undefined);
      setDrawerOpen(false);
    },
    [herdr.snapshot, selectPane],
  );

  const selectTab = useCallback(
    (tabId: string) => {
      const tab = herdr.snapshot.tabs.find((item) => item.tabId === tabId);
      const pane = paneForTab(herdr.snapshot, tabId);
      if (pane) {
        selectPane(pane.paneId);
        return;
      }
      if (tab) setSelectedWorkspaceId(tab.workspaceId);
      setSelectedTabId(tabId);
      setSelectedPaneId(undefined);
      setDrawerOpen(false);
    },
    [herdr.snapshot, selectPane],
  );

  const openConnection = useCallback(() => {
    if (compact && drawerOpen) {
      setDrawerOpen(false);
      InteractionManager.runAfterInteractions(() => setConnectionOpen(true));
      return;
    }
    setConnectionOpen(true);
  }, [compact, drawerOpen]);

  const openCreateSpace = useCallback(() => {
    if (!canWrite) return;
    if (compact && drawerOpen) {
      setDrawerOpen(false);
      InteractionManager.runAfterInteractions(() => setSpaceCreateOpen(true));
      return;
    }
    setSpaceCreateOpen(true);
  }, [canWrite, compact, drawerOpen]);

  const createSpace = async (input: { label?: string; cwd?: string }) => {
    const result = await herdr.createWorkspace({
      requestId: uuidv4(),
      ...input,
    });
    if (!result.ok) throw new Error(result.error);
    setSelectedWorkspaceId(result.pane.workspaceId);
    setSelectedTabId(result.pane.tabId);
    setSelectedPaneId(result.pane.paneId);
    setSpaceCreateOpen(false);
    setDrawerOpen(false);
    pendingFocusPaneId.current = result.pane.paneId;
    if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
    pendingFocusTimer.current = setTimeout(() => {
      if (pendingFocusPaneId.current !== result.pane.paneId) return;
      pendingFocusPaneId.current = undefined;
      pendingFocusTimer.current = null;
      void herdr.refresh();
    }, 2_500);
    const focused = await herdr.focusPane(result.pane.paneId);
    if (!focused.ok && !focused.cancelled) setTerminalError(focused.error);
  };

  const createShellTab = async (workspace: WorkspaceView) => {
    if (!canWrite || creatingTabWorkspaceId) return;
    setCreatingTabWorkspaceId(workspace.workspaceId);
    setTerminalError(null);
    try {
      const result = await herdr.createTab({
        workspaceId: workspace.workspaceId,
        requestId: uuidv4(),
      });
      if (!result.ok) throw new Error(result.error);
      setSelectedWorkspaceId(result.pane.workspaceId);
      setSelectedTabId(result.pane.tabId);
      setSelectedPaneId(result.pane.paneId);
      setDrawerOpen(false);
      pendingFocusPaneId.current = result.pane.paneId;
      if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
      pendingFocusTimer.current = setTimeout(() => {
        if (pendingFocusPaneId.current !== result.pane.paneId) return;
        pendingFocusPaneId.current = undefined;
        pendingFocusTimer.current = null;
        void herdr.refresh();
      }, 2_500);
      const focused = await herdr.focusPane(result.pane.paneId);
      if (!focused.ok && !focused.cancelled) throw new Error(focused.error);
    } catch (reason) {
      setTerminalError(
        reason instanceof Error ? reason.message : "Shell tab could not be created.",
      );
    } finally {
      setCreatingTabWorkspaceId(undefined);
    }
  };

  const createWorktree = async (input: { branch?: string; base?: string; label?: string }) => {
    if (!createTarget) return;
    const result = await herdr.createWorktree({
      workspaceId: createTarget.workspaceId,
      requestId: uuidv4(),
      ...input,
    });
    if (!result.ok) throw new Error(result.error);
    setSelectedWorkspaceId(result.workspace.workspaceId);
    setSelectedTabId(result.tab.tabId);
    setSelectedPaneId(result.pane.paneId);
    setCreateTarget(null);
  };

  const removeWorktree = async (force: boolean) => {
    if (!removeTarget) return;
    const result = await herdr.removeWorktree(removeTarget.workspaceId, force, uuidv4());
    if (!result.ok) throw new Error(result.error);
    setRemoveTarget(null);
  };

  const renameTab = async (label: string) => {
    if (!renameTarget) return;
    const result = await herdr.renameTab(renameTarget.tabId, label);
    if (!result.ok) throw new Error(result.error);
    setRenameTarget(null);
  };

  const attachImages = async () => {
    if (!selectedPane || !canWrite || imageUploadPaneId) return;
    const paneId = selectedPane.paneId;
    setImageUploadPaneId(paneId);
    setTerminalError(null);
    try {
      const selection = await pickComposerImages({ existingCount: 0 });
      const supported = selection.images.filter((image) =>
        isHerdrUploadMimeType(image.mimeType),
      );
      const unsupportedCount = selection.images.length - supported.length;
      if (supported.length === 0) {
        setTerminalError(
          selection.error ??
            (unsupportedCount > 0
              ? "Herdr supports PNG, JPEG, GIF, and WebP image attachments."
              : null),
        );
        return;
      }
      const result = await stageAndPasteHerdrImages({
        images: supported.map((image) => ({
          name: image.name,
          mimeType: image.mimeType,
          dataUrl: image.dataUrl,
          uri: image.previewUri,
        })),
        upload: (image) => herdr.uploadImage(paneId, image),
        paste: (remotePaths) => herdr.sendInput(paneId, remotePaths),
      });
      if (!result.ok) {
        setTerminalError(result.error);
        return;
      }
      if (selection.error || unsupportedCount > 0) {
        setTerminalError(
          selection.error ?? "Some images were skipped. Herdr supports PNG, JPEG, GIF, and WebP.",
        );
      }
    } catch (reason) {
      setTerminalError(reason instanceof Error ? reason.message : "Image attachment failed.");
    } finally {
      setImageUploadPaneId(undefined);
    }
  };

  const navigator = (
    <Navigator
      snapshot={herdr.snapshot}
      mode={herdr.mode}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedPaneId={selectedPaneId}
      compact={compact}
      canWrite={canWrite}
      creatingTabWorkspaceId={creatingTabWorkspaceId}
      onClose={() => setDrawerOpen(false)}
      onSelectSpace={selectSpace}
      onSelectPane={selectPane}
      onCreateSpace={openCreateSpace}
      onCreateTab={createShellTab}
      onCreateWorktree={setCreateTarget}
      onRemoveWorktree={setRemoveTarget}
      onOpenConnection={openConnection}
    />
  );

  return (
    <View className="flex-1 flex-row bg-screen">
      {herdr.mode === "connecting" ? <LoadingStrip /> : null}
      {!compact ? <View style={{ width: SIDEBAR_WIDTH }}>{navigator}</View> : null}

      <View className="min-w-0 flex-1 bg-screen">
        <GlassSafeAreaView
          leftSlot={
            compact ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open repositories and terminals"
                onPress={() => setDrawerOpen(true)}
                className="h-10 w-10 items-center justify-center rounded-full bg-subtle"
              >
                <SymbolView name="sidebar.left" size={18} tintColor={iconColor} type="monochrome" />
              </Pressable>
            ) : (
              <View className="h-10 w-10" />
            )
          }
          centerSlot={
            <View className="items-center">
              <Text className="text-base font-t3-extrabold" numberOfLines={1}>
                {selectedSpace?.label ?? "Herdr"}
              </Text>
              <Text className="text-3xs text-foreground-muted" numberOfLines={1}>
                {selectedPane?.cwd ?? "Select a terminal"}
              </Text>
            </View>
          }
          rightSlot={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh Herdr"
              onPress={() => void herdr.refresh()}
              className="h-10 w-10 items-center justify-center rounded-full bg-subtle"
            >
              <SymbolView
                name="arrow.clockwise"
                size={17}
                tintColor={iconColor}
                type="monochrome"
              />
            </Pressable>
          }
        />

        <View className="border-b border-border bg-sheet">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="items-center gap-1 px-3"
          >
            {tabs.map((tab) => {
              const active = tab.tabId === selectedTabId;
              return (
                <View
                  key={tab.tabId}
                  className={`h-14 min-w-24 flex-row items-center border-b-2 ${active ? "border-foreground" : "border-transparent"}`}
                >
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${tab.label} CLI`}
                    onPress={() => selectTab(tab.tabId)}
                    className={`h-full min-w-16 flex-1 items-center justify-center active:opacity-60 ${active ? "pl-4 pr-1" : "px-4"}`}
                  >
                    <Text
                      className={`text-sm font-t3-bold ${active ? "text-foreground" : "text-foreground-muted"}`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                  {active ? (
                    <ControlPillMenu
                      actions={[
                        {
                          id: "rename-tab",
                          title: "Rename tab",
                          image: "square.and.pencil",
                          attributes: { disabled: !canWrite },
                        },
                      ]}
                      title={tab.label}
                      onPressAction={({ nativeEvent }) => {
                        if (nativeEvent.event === "rename-tab") setRenameTarget(tab);
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Options for tab ${tab.label}`}
                        className="h-10 w-9 items-center justify-center rounded-full active:bg-subtle"
                      >
                        <SymbolView
                          name="ellipsis"
                          size={15}
                          tintColor={mutedIcon}
                          type="monochrome"
                        />
                      </Pressable>
                    </ControlPillMenu>
                  ) : null}
                </View>
              );
            })}
            {selectedSpace ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`New shell tab in ${selectedSpace.label}`}
                disabled={!canWrite || Boolean(creatingTabWorkspaceId)}
                onPress={() => void createShellTab(selectedSpace)}
                className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-60 disabled:opacity-35"
              >
                {creatingTabWorkspaceId === selectedSpace.workspaceId ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <SymbolView name="plus" size={16} tintColor={iconColor} type="monochrome" />
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {herdr.error ? (
          <View className="px-4 pt-4">
            <ErrorBanner message={herdr.error} />
          </View>
        ) : null}
        {terminalError ? (
          <View className="px-4 pt-3">
            <ErrorBanner message={terminalError} />
          </View>
        ) : null}

        {selectedPane ? (
          <View className="min-h-0 flex-1">
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-subtle-strong">
                <SymbolView name="terminal" size={17} tintColor={mutedIcon} type="monochrome" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-t3-extrabold" numberOfLines={1}>
                  {displayPane(selectedPane)}
                </Text>
                <Text className="text-3xs text-foreground-muted" numberOfLines={1}>
                  Live terminal · {tabs.find((tab) => tab.tabId === selectedPane.tabId)?.label}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Attach image to terminal"
                disabled={!canWrite || Boolean(imageUploadPaneId)}
                onPress={() => void attachImages()}
                className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-60 disabled:opacity-35"
              >
                {imageUploadPaneId === selectedPane.paneId ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <SymbolView name="photo" size={17} tintColor={iconColor} type="monochrome" />
                )}
              </Pressable>
              <StatusPill {...STATUS_TONES[selectedPane.status]} size="compact" />
            </View>
            {paneState.error ? (
              <View className="px-4 pb-3">
                <ErrorBanner message={`Updates paused: ${paneState.error}`} />
              </View>
            ) : null}
            <View className="min-h-0 flex-1" style={{ paddingBottom: bottomInset }}>
              <TerminalSurface
                terminalKey={`herdr\n${connectionKey}\n${presentedPaneId ?? selectedPane.paneId}`}
                buffer={presentedOutput?.text ?? ""}
                fontSize={11}
                isRunning={canWrite}
                autoFocus={false}
                style={{ flex: 1 }}
                onInput={(data) => {
                  setTerminalError(null);
                  void herdr
                    .sendInput(selectedPane.paneId, data)
                    .then((result) => {
                      if (!result.ok && !result.cancelled) setTerminalError(result.error);
                    })
                    .catch((reason: unknown) => {
                      setTerminalError(
                        reason instanceof Error ? reason.message : "Terminal input failed.",
                      );
                    });
                }}
                onResize={(size) => {
                  setTerminalSize((current) =>
                    current?.cols === size.cols && current.rows === size.rows ? current : size,
                  );
                }}
                onViewportScroll={(rows) => {
                  if (presentedPaneId === selectedPane.paneId) {
                    herdr.scrollPane(selectedPane.paneId, rows);
                  }
                }}
              />
              {paneState.loading && !paneState.output ? (
                <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                  <ActivityIndicator />
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
            <View className="h-16 w-16 items-center justify-center rounded-3xl bg-subtle-strong">
              <SymbolView name="terminal" size={28} tintColor={mutedIcon} type="monochrome" />
            </View>
            <Text className="text-xl font-t3-extrabold">Choose a terminal tab</Text>
            <Text className="max-w-80 text-center text-sm leading-5 text-foreground-muted">
              Each Herdr tab is mirrored as its native CLI or TUI, including ANSI color and terminal
              layout.
            </Text>
          </View>
        )}
      </View>

      {compact ? (
        <Modal
          visible={drawerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDrawerOpen(false)}
        >
          <View className="flex-1 flex-row bg-backdrop">
            <View style={{ width: Math.min(SIDEBAR_WIDTH, width * 0.9) }}>{navigator}</View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close navigator"
              onPress={() => setDrawerOpen(false)}
              className="flex-1"
            />
          </View>
        </Modal>
      ) : null}

      <ConnectionSheet
        visible={connectionOpen}
        initial={herdr.config}
        onClose={() => setConnectionOpen(false)}
        onConnect={herdr.connect}
        onDemo={herdr.useDemo}
      />
      <WorkspaceCreateSheet
        visible={spaceCreateOpen}
        onClose={() => setSpaceCreateOpen(false)}
        onCreate={createSpace}
      />
      <WorktreeCreateSheet
        workspace={createTarget}
        onClose={() => setCreateTarget(null)}
        onCreate={createWorktree}
      />
      <WorktreeRemoveSheet
        workspace={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onRemove={removeWorktree}
      />
      <TabRenameSheet
        tab={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={renameTab}
      />
    </View>
  );
}
