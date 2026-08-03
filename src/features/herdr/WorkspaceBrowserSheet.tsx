import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text, AppTextInput } from "../../components/AppText";
import { ErrorBanner } from "../../components/ErrorBanner";
import { PierreEntryIcon } from "../../components/PierreEntryIcon";
import { SymbolView } from "../../components/AppSymbol";
import { FileTreeBrowser } from "../files/FileTreeBrowser";
import type {
  AgentView,
  WorkspaceFileResponse,
  WorkspaceFilesResponse,
  WorkspaceGitDiffResponse,
  WorkspaceGitFile,
  WorkspaceGitStatusResponse,
  WorkspaceView,
} from "../../lib/types";
import { useThemeColor } from "../../lib/useThemeColor";
import { retainedRefreshMessage } from "./workspace-browser-model";

type BrowserSection = "files" | "changes";
type DocumentSelection = { kind: "file" | "diff"; path: string };

const MONO_FONT = Platform.select({
  ios: "ui-monospace",
  android: "monospace",
  default: "monospace",
});

function basename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function BrowserHeader(props: {
  title: string;
  subtitle?: string;
  back: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor("--color-icon");
  return (
    <View
      className="flex-row items-center gap-3 border-b border-border px-5 pb-3"
      style={{ paddingTop: insets.top + 12, minHeight: insets.top + 72 }}
    >
      {props.back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to workspace browser"
          onPress={props.onBack}
          className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-65"
        >
          <SymbolView name="chevron.left" size={17} tintColor={iconColor} type="monochrome" />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-t3-extrabold" numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text className="mt-0.5 text-3xs text-foreground-muted" numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close workspace browser"
        onPress={props.onClose}
        className="h-10 w-10 items-center justify-center rounded-full bg-subtle active:opacity-65"
      >
        <SymbolView name="xmark" size={17} tintColor={iconColor} type="monochrome" />
      </Pressable>
    </View>
  );
}

function SectionPicker(props: {
  section: BrowserSection;
  fileCount: number;
  changeCount: number;
  onChange: (section: BrowserSection) => void;
}) {
  return (
    <View className="mx-4 mt-4 flex-row rounded-2xl bg-subtle p-1">
      {(
        [
          ["files", `Files ${props.fileCount}`],
          ["changes", `Changes ${props.changeCount}`],
        ] as const
      ).map(([section, label]) => {
        const selected = props.section === section;
        return (
          <Pressable
            key={section}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => props.onChange(section)}
            className={`h-10 flex-1 items-center justify-center rounded-xl active:opacity-70 ${selected ? "bg-card" : ""}`}
          >
            <Text
              className={`text-xs font-t3-bold ${selected ? "text-foreground" : "text-foreground-muted"}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CodeDocument(props: { contents: string; kind: "file" | "diff" }) {
  const lines = useMemo(() => props.contents.replace(/\r\n/g, "\n").split("\n"), [props.contents]);
  const list = (
    <FlatList
      data={lines}
      keyExtractor={(_line, index) => String(index)}
      initialNumToRender={80}
      maxToRenderPerBatch={80}
      windowSize={10}
      contentContainerStyle={{ minWidth: "100%", paddingVertical: 12 }}
      renderItem={({ item, index }) => {
        const added = props.kind === "diff" && item.startsWith("+") && !item.startsWith("+++");
        const deleted = props.kind === "diff" && item.startsWith("-") && !item.startsWith("---");
        const header = props.kind === "diff" && (item.startsWith("@@") || item.startsWith("diff "));
        return (
          <View
            className={`min-h-5 flex-row px-2 ${added ? "bg-emerald-500/10" : deleted ? "bg-rose-500/10" : ""}`}
          >
            <Text
              selectable={false}
              className="mr-3 w-9 text-right text-3xs text-foreground-tertiary"
              style={{ fontFamily: MONO_FONT, lineHeight: 20 }}
            >
              {index + 1}
            </Text>
            <Text
              selectable
              className={
                header
                  ? "text-xs font-t3-bold text-blue-600 dark:text-blue-300"
                  : added
                    ? "text-xs text-emerald-700 dark:text-emerald-300"
                    : deleted
                      ? "text-xs text-rose-700 dark:text-rose-300"
                      : "text-xs text-foreground"
              }
              style={{ fontFamily: MONO_FONT, lineHeight: 20 }}
            >
              {item || " "}
            </Text>
          </View>
        );
      }}
    />
  );
  return (
    <ScrollView horizontal bounces={false} className="flex-1 bg-sheet">
      {list}
    </ScrollView>
  );
}

function GitSummary(props: { status: WorkspaceGitStatusResponse }) {
  const iconColor = useThemeColor("--color-icon-muted");
  if (!props.status.isRepo) {
    return (
      <View className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-sm font-t3-bold">Not a Git repository</Text>
        <Text className="mt-1 text-xs text-foreground-muted">
          File browsing is still available for this workspace.
        </Text>
      </View>
    );
  }
  return (
    <View className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-2">
        <SymbolView
          name="arrow.triangle.branch"
          size={16}
          tintColor={iconColor}
          type="monochrome"
        />
        <Text className="min-w-0 flex-1 text-sm font-t3-extrabold" numberOfLines={1}>
          {props.status.branch ?? "Detached HEAD"}
        </Text>
        {props.status.ahead > 0 ? (
          <Text className="text-2xs font-t3-bold text-emerald-600">↑ {props.status.ahead}</Text>
        ) : null}
        {props.status.behind > 0 ? (
          <Text className="text-2xs font-t3-bold text-amber-600">↓ {props.status.behind}</Text>
        ) : null}
      </View>
      <View className="mt-2 flex-row gap-3">
        <Text className="text-2xs text-foreground-muted">
          {props.status.files.length} changed file{props.status.files.length === 1 ? "" : "s"}
        </Text>
        <Text className="text-2xs font-t3-bold text-emerald-600">+{props.status.insertions}</Text>
        <Text className="text-2xs font-t3-bold text-rose-600">−{props.status.deletions}</Text>
      </View>
    </View>
  );
}

function GitFileRow(props: { file: WorkspaceGitFile; onPress: (path: string) => void }) {
  const iconColor = useThemeColor("--color-icon-muted");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.file.status} ${props.file.path}`}
      onPress={() => props.onPress(props.file.path)}
      className="mx-4 min-h-14 flex-row items-center gap-3 border-b border-border-subtle py-2.5 active:opacity-65"
    >
      <PierreEntryIcon path={props.file.path} kind="file" size={18} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-t3-bold" numberOfLines={1}>
          {props.file.path}
        </Text>
        <Text className="mt-0.5 text-3xs text-foreground-muted">{props.file.status}</Text>
      </View>
      {props.file.insertions > 0 ? (
        <Text className="text-2xs font-t3-bold text-emerald-600">+{props.file.insertions}</Text>
      ) : null}
      {props.file.deletions > 0 ? (
        <Text className="text-2xs font-t3-bold text-rose-600">−{props.file.deletions}</Text>
      ) : null}
      <SymbolView name="chevron.right" size={13} tintColor={iconColor} type="monochrome" />
    </Pressable>
  );
}

export function WorkspaceBrowserSheet(props: {
  visible: boolean;
  workspace: WorkspaceView | undefined;
  pane: AgentView | undefined;
  onClose: () => void;
  listFiles: (
    workspaceId: string,
    paneId: string,
    signal?: AbortSignal,
  ) => Promise<WorkspaceFilesResponse>;
  readFile: (
    workspaceId: string,
    paneId: string,
    path: string,
    signal?: AbortSignal,
  ) => Promise<WorkspaceFileResponse>;
  readGit: (
    workspaceId: string,
    paneId: string,
    signal?: AbortSignal,
  ) => Promise<WorkspaceGitStatusResponse>;
  readDiff: (
    workspaceId: string,
    paneId: string,
    path: string,
    signal?: AbortSignal,
  ) => Promise<WorkspaceGitDiffResponse>;
}) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<BrowserSection>("files");
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<WorkspaceFilesResponse | null>(null);
  const [git, setGit] = useState<WorkspaceGitStatusResponse | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [selection, setSelection] = useState<DocumentSelection | null>(null);
  const [document, setDocument] = useState<WorkspaceFileResponse | WorkspaceGitDiffResponse | null>(
    null,
  );
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const filesGeneration = useRef(0);
  const gitGeneration = useRef(0);
  const documentGeneration = useRef(0);
  const filesRequest = useRef<AbortController | null>(null);
  const gitRequest = useRef<AbortController | null>(null);
  const documentRequest = useRef<AbortController | null>(null);
  const workspaceId = props.workspace?.workspaceId;
  const paneId = props.pane?.paneId;

  const refreshFiles = useCallback(async () => {
    if (!workspaceId || !paneId) return;
    filesRequest.current?.abort();
    const controller = new AbortController();
    filesRequest.current = controller;
    const generation = ++filesGeneration.current;
    setFilesLoading(true);
    setFilesError(null);
    try {
      const nextFiles = await props.listFiles(workspaceId, paneId, controller.signal);
      if (generation !== filesGeneration.current) return;
      setFiles(nextFiles);
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (generation !== filesGeneration.current) return;
      setFilesError(reason instanceof Error ? reason.message : "Workspace files could not load.");
    } finally {
      if (filesRequest.current === controller) filesRequest.current = null;
      if (generation === filesGeneration.current) setFilesLoading(false);
    }
  }, [paneId, props.listFiles, workspaceId]);

  const refreshGit = useCallback(async () => {
    if (!workspaceId || !paneId) return;
    gitRequest.current?.abort();
    const controller = new AbortController();
    gitRequest.current = controller;
    const generation = ++gitGeneration.current;
    setGitLoading(true);
    setGitError(null);
    try {
      const nextGit = await props.readGit(workspaceId, paneId, controller.signal);
      if (generation !== gitGeneration.current) return;
      setGit(nextGit);
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (generation !== gitGeneration.current) return;
      setGitError(reason instanceof Error ? reason.message : "Git status could not load.");
    } finally {
      if (gitRequest.current === controller) gitRequest.current = null;
      if (generation === gitGeneration.current) setGitLoading(false);
    }
  }, [paneId, props.readGit, workspaceId]);

  useEffect(() => {
    if (!props.visible) return;
    filesRequest.current?.abort();
    gitRequest.current?.abort();
    documentRequest.current?.abort();
    filesGeneration.current += 1;
    gitGeneration.current += 1;
    documentGeneration.current += 1;
    setSection("files");
    setSearch("");
    setFiles(null);
    setGit(null);
    setFilesLoading(false);
    setGitLoading(false);
    setDocumentLoading(false);
    setFilesError(null);
    setGitError(null);
    setSelection(null);
    setDocument(null);
    setDocumentError(null);
    if (workspaceId && paneId) {
      void refreshFiles();
      void refreshGit();
    }
    return () => {
      filesRequest.current?.abort();
      gitRequest.current?.abort();
      documentRequest.current?.abort();
      filesGeneration.current += 1;
      gitGeneration.current += 1;
      documentGeneration.current += 1;
    };
  }, [paneId, props.visible, refreshFiles, refreshGit, workspaceId]);

  const openDocument = useCallback(
    async (next: DocumentSelection) => {
      if (!workspaceId || !paneId) return;
      documentRequest.current?.abort();
      const controller = new AbortController();
      documentRequest.current = controller;
      const generation = ++documentGeneration.current;
      setSelection(next);
      setDocument(null);
      setDocumentLoading(true);
      setDocumentError(null);
      try {
        const result =
          next.kind === "file"
            ? await props.readFile(workspaceId, paneId, next.path, controller.signal)
            : await props.readDiff(workspaceId, paneId, next.path, controller.signal);
        if (generation === documentGeneration.current) setDocument(result);
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (generation === documentGeneration.current) {
          setDocumentError(
            reason instanceof Error ? reason.message : "Workspace document could not load.",
          );
        }
      } finally {
        if (documentRequest.current === controller) documentRequest.current = null;
        if (generation === documentGeneration.current) setDocumentLoading(false);
      }
    },
    [paneId, props.readDiff, props.readFile, workspaceId],
  );

  const closeDocument = useCallback(() => {
    documentRequest.current?.abort();
    documentRequest.current = null;
    documentGeneration.current += 1;
    setSelection(null);
    setDocument(null);
    setDocumentLoading(false);
    setDocumentError(null);
  }, []);

  const imageSource =
    document && "encoding" in document && document.encoding === "base64"
      ? { uri: `data:${document.mediaType};base64,${document.content}` }
      : null;
  const documentContents =
    document && "encoding" in document
      ? document.encoding === "utf8"
        ? document.content
        : ""
      : document && "patch" in document
        ? document.patch
        : "";
  const filesRefreshMessage = retainedRefreshMessage(
    filesError,
    Boolean(files?.entries.length),
    "workspace files",
  );
  const gitRefreshMessage = retainedRefreshMessage(
    gitError,
    Boolean(git?.files.length),
    "Git status",
  );

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={selection ? closeDocument : props.onClose}
    >
      <View className="flex-1 bg-screen" style={{ paddingBottom: insets.bottom }}>
        <BrowserHeader
          title={selection ? basename(selection.path) : (props.workspace?.label ?? "Workspace")}
          subtitle={selection ? selection.path : (files?.root ?? props.pane?.cwd)}
          back={selection !== null}
          onBack={closeDocument}
          onClose={props.onClose}
        />

        {selection ? (
          <View className="flex-1">
            <View className="border-b border-border bg-card px-4 py-2">
              <Text className="text-2xs text-foreground-muted" numberOfLines={1}>
                {selection.path}
              </Text>
              {document && "patch" in document && document.truncated ? (
                <Text className="mt-1 text-3xs font-t3-bold text-amber-700 dark:text-amber-300">
                  This diff exceeds the preview limit and is truncated.
                </Text>
              ) : null}
            </View>
            {documentLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : documentError ? (
              <View className="px-5 py-6">
                <Text className="text-sm font-t3-bold">Preview unavailable</Text>
                <Text className="mt-1 text-xs text-foreground-muted">{documentError}</Text>
              </View>
            ) : imageSource ? (
              <ScrollView contentContainerClassName="flex-grow items-center justify-center p-5">
                <Image
                  source={imageSource}
                  resizeMode="contain"
                  style={{ width: "100%", height: 520 }}
                />
              </ScrollView>
            ) : (
              <CodeDocument contents={documentContents} kind={selection.kind} />
            )}
          </View>
        ) : (
          <View className="flex-1">
            <SectionPicker
              section={section}
              fileCount={files?.entries.filter((entry) => entry.kind === "file").length ?? 0}
              changeCount={git?.files.length ?? 0}
              onChange={setSection}
            />
            {section === "files" ? (
              <View className="flex-1">
                <View className="px-4 pb-2 pt-3">
                  <AppTextInput
                    accessibilityLabel="Search workspace files"
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Search files"
                  />
                  {files?.truncated ? (
                    <Text className="mt-2 text-3xs text-amber-700 dark:text-amber-300">
                      Showing the first 12,000 entries.
                    </Text>
                  ) : null}
                </View>
                {filesRefreshMessage ? (
                  <View className="px-4 pb-2">
                    <ErrorBanner message={filesRefreshMessage} />
                  </View>
                ) : null}
                <FileTreeBrowser
                  entries={files?.entries ?? []}
                  error={filesError}
                  isPending={filesLoading}
                  searchQuery={search}
                  selectedPath={null}
                  onRefresh={() => void refreshFiles()}
                  onSelectFile={(path) => void openDocument({ kind: "file", path })}
                />
              </View>
            ) : (
              <FlatList
                className="flex-1"
                data={git?.files ?? []}
                keyExtractor={(file) => file.path}
                refreshControl={
                  <RefreshControl refreshing={gitLoading} onRefresh={() => void refreshGit()} />
                }
                ListHeaderComponent={
                  git || gitRefreshMessage ? (
                    <>
                      {git ? <GitSummary status={git} /> : null}
                      {gitRefreshMessage ? (
                        <View className="mx-4 mt-3">
                          <ErrorBanner message={gitRefreshMessage} />
                        </View>
                      ) : null}
                    </>
                  ) : null
                }
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => (
                  <GitFileRow
                    file={item}
                    onPress={(path) => void openDocument({ kind: "diff", path })}
                  />
                )}
                ListEmptyComponent={
                  gitLoading ? (
                    <View className="py-10">
                      <ActivityIndicator />
                    </View>
                  ) : gitError ? (
                    <View className="px-5 py-6">
                      <Text className="text-sm font-t3-bold">Git status unavailable</Text>
                      <Text className="mt-1 text-xs text-foreground-muted">{gitError}</Text>
                    </View>
                  ) : git?.isRepo ? (
                    <View className="px-5 py-8">
                      <Text className="text-center text-sm font-t3-bold">Working tree clean</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
