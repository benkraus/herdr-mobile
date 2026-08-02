import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLiveUrl,
  decodeLiveEvent,
  HerdrHttpError,
  HerdrHttpTransport,
  isUnknownSessionError,
} from "./transport";

const { nativeFileUploadMock } = vi.hoisted(() => ({ nativeFileUploadMock: vi.fn() }));

vi.mock("expo-file-system", () => ({
  File: class MockFile {
    readonly uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    upload = nativeFileUploadMock;
  },
  UploadType: { MULTIPART: 1 },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  nativeFileUploadMock.mockReset();
});

describe("HerdrHttpTransport", () => {
  it("uses a session-scoped secure WebSocket for Herdr live events", () => {
    expect(buildLiveUrl("https://buildbox.example.ts.net", "work horse")).toBe(
      "wss://buildbox.example.ts.net/api/live?session=work+horse",
    );
    expect(buildLiveUrl("http://127.0.0.1:8787", undefined)).toBe(
      "ws://127.0.0.1:8787/api/live",
    );
  });

  it("validates live snapshot, pane revision, status, and consecutive ANSI frame events", () => {
    expect(decodeLiveEvent('{"type":"snapshot_changed"}')).toEqual({ type: "snapshot_changed" });
    expect(
      decodeLiveEvent('{"type":"pane_output_changed","paneId":"w1:p1","revision":42}'),
    ).toEqual({ type: "pane_output_changed", paneId: "w1:p1", revision: 42 });
    expect(
      decodeLiveEvent('{"type":"pane_stream_status","paneId":"w1:p1","live":true}'),
    ).toEqual({ type: "pane_stream_status", paneId: "w1:p1", live: true });
    expect(decodeLiveEvent(JSON.stringify({
      type: "pane_frame",
      paneId: "w1:p1",
      seq: 1,
      full: true,
      width: 80,
      height: 24,
      bytes: "G1sySkrDqg==",
    }))).toEqual({
      type: "pane_frame",
      paneId: "w1:p1",
      seq: 1,
      full: true,
      width: 80,
      height: 24,
      text: "\u001b[2JJê",
    });
    expect(decodeLiveEvent('{"type":"pane_output_changed","paneId":3}')).toBeNull();
    expect(decodeLiveEvent(JSON.stringify({
      type: "pane_frame",
      paneId: "w1:p1",
      seq: 2,
      full: false,
      width: 80,
      height: 24,
      bytes: "not base64!",
    }))).toBeNull();
  });

  it("scopes snapshot and pane reads to the configured Herdr session", async () => {
    const fetchMock = vi.fn().mockImplementation((input: URL) =>
      Promise.resolve(
        new Response(JSON.stringify(
          String(input).includes("/api/pane/")
            ? { paneId: "space:tab/pane", text: "", truncated: false, revision: 1 }
            : { bridge: "connected", agents: [], shellPanes: [], workspaces: [], tabs: [], ts: 1 },
        )),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({
      baseUrl: "https://buildbox.example.ts.net/",
      session: "work horse",
    });

    await transport.snapshot();
    await transport.pane("space:tab/pane");

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://buildbox.example.ts.net/api/snapshot?session=work+horse",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://buildbox.example.ts.net/api/pane/space%3Atab%2Fpane?lines=320&session=work+horse",
    );
  });

  it("sends replies through the bridge rather than an SSH client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });

    await expect(transport.reply("pane-1", {
      text: "continue",
      requestId: "request-1",
    })).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ text: "continue", submit: true, requestId: "request-1" }),
      headers: expect.objectContaining({ "x-herdr-client": "herdr-mobile-v1" }),
    });
  });

  it("uploads image bytes as multipart data without overriding its boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, path: "/tmp/herdr-clipboard-images-501/image.png" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({
      baseUrl: "https://buildbox.example.ts.net",
      session: "work horse",
    });

    await expect(
      transport.uploadImage("space:tab/pane", {
        name: "screen.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,aGVsbG8=",
      }),
    ).resolves.toEqual({
      ok: true,
      path: "/tmp/herdr-clipboard-images-501/image.png",
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(
      "https://buildbox.example.ts.net/api/pane/space%3Atab%2Fpane/upload?session=work+horse",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "x-herdr-client": "herdr-mobile-v1" });
    expect(init.headers).not.toHaveProperty("content-type");
    expect(init.body).toBeInstanceOf(FormData);
    const file = (init.body as FormData).get("file");
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe("image/png");
    expect(await (file as Blob).text()).toBe("hello");
  });

  it("streams native picker files through the platform multipart uploader", async () => {
    nativeFileUploadMock.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, path: "/tmp/uploads/native.png" }),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({
      baseUrl: "https://buildbox.example.ts.net",
      session: "work horse",
    });

    await expect(transport.uploadImage("space:tab/pane", {
      name: "screen.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,aGVsbG8=",
      uri: "file:///data/user/0/dev.herdr.mobile/cache/ImagePicker/screen.png",
    })).resolves.toEqual({ ok: true, path: "/tmp/uploads/native.png" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(nativeFileUploadMock).toHaveBeenCalledWith(
      "https://buildbox.example.ts.net/api/pane/space%3Atab%2Fpane/upload?session=work+horse",
      expect.objectContaining({
        httpMethod: "POST",
        uploadType: 1,
        fieldName: "file",
        mimeType: "image/png",
        headers: { "x-herdr-client": "herdr-mobile-v1" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("forwards terminal, space, tab, and worktree lifecycle mutations", async () => {
    const createdTab = {
      ok: true,
      pane: {
        paneId: "w1:p2",
        workspaceId: "w1",
        workspaceLabel: "repo",
        tabId: "w1:t2",
        cwd: "/repo",
      },
    };
    const worktree = {
      ok: true,
      workspace: {
        workspaceId: "w2",
        number: 2,
        label: "mobile",
        focused: false,
        activeTabId: "w2:t1",
        tabCount: 1,
        paneCount: 1,
        worktree: {
          repoKey: "/repo/.git",
          repoName: "repo",
          repoRoot: "/repo",
          checkoutPath: "/worktrees/mobile",
          isLinkedWorktree: true,
        },
      },
      tab: { tabId: "w2:t1", workspaceId: "w2", number: 1, label: "shell", focused: true, paneCount: 1 },
      pane: { paneId: "w2:p1", workspaceId: "w2", workspaceLabel: "mobile", tabId: "w2:t1", cwd: "/worktrees/mobile" },
    };
    const createdWorkspace = {
      ok: true,
      pane: {
        paneId: "w3:p1",
        workspaceId: "w3",
        workspaceLabel: "scratch",
        tabId: "w3:t1",
        cwd: "/tmp/scratch",
      },
    };
    const fetchMock = vi.fn().mockImplementation((input: URL) => {
      const url = String(input);
      const value = url.endsWith("/api/worktree")
        ? worktree
        : url.endsWith("/api/workspace")
          ? createdWorkspace
        : url.endsWith("/api/tab")
          ? createdTab
          : { ok: true };
      return Promise.resolve(new Response(JSON.stringify(value)));
    });
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });

    await transport.input("pane-1", "a\r");
    await transport.focusPane("pane-1");
    await transport.createTab({ workspaceId: "w1", requestId: "tab-1" });
    await transport.createWorkspace({
      label: "scratch",
      cwd: "/tmp/scratch",
      requestId: "space-1",
    });
    await transport.renameTab("w1:t2", "Review");
    await transport.createWorktree({ workspaceId: "w1", branch: "mobile", requestId: "create-1" });
    await transport.removeWorktree("w2", true, "remove-1");

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://buildbox.example.ts.net/api/pane/pane-1/input",
      "https://buildbox.example.ts.net/api/focus/pane-1",
      "https://buildbox.example.ts.net/api/tab",
      "https://buildbox.example.ts.net/api/workspace",
      "https://buildbox.example.ts.net/api/tab/w1%3At2",
      "https://buildbox.example.ts.net/api/worktree",
      "https://buildbox.example.ts.net/api/worktree/w2",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ data: "a\r" }) });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ workspaceId: "w1", requestId: "tab-1" }),
    });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        label: "scratch",
        cwd: "/tmp/scratch",
        requestId: "space-1",
      }),
    });
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ label: "Review" }),
    });
    expect(fetchMock.mock.calls[6]?.[1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ force: true, requestId: "remove-1" }),
    });
  });

  it("accepts workspace worktree identity in snapshots", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      bridge: "connected",
      agents: [],
      shellPanes: [],
      workspaces: [{
        workspaceId: "w1",
        number: 1,
        label: "repo",
        focused: true,
        activeTabId: "w1:t1",
        tabCount: 1,
        paneCount: 1,
        worktree: {
          repoKey: "/repo/.git",
          repoName: "repo",
          repoRoot: "/repo",
          checkoutPath: "/repo",
          isLinkedWorktree: false,
        },
      }],
      tabs: [],
      ts: 1,
    }))));
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });
    await expect(transport.snapshot()).resolves.toMatchObject({
      workspaces: [{ worktree: { repoKey: "/repo/.git", isLinkedWorktree: false } }],
    });
  });

  it("surfaces bridge response details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("device is read-only", { status: 403 })));
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });
    await expect(transport.reply("pane-1", { text: "continue", requestId: "request-2" })).rejects.toThrow("403 device is read-only");
    await transport.reply("pane-1", { text: "continue", requestId: "request-2" }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(HerdrHttpError);
      expect((error as HerdrHttpError).status).toBe(403);
    });
  });

  it("only classifies the bridge's exact unknown-session response as a stale session", () => {
    expect(
      isUnknownSessionError(
        new HerdrHttpError(
          404,
          '404 {"error":"unknown session: work"}',
          '{"error":"unknown session: work"}',
        ),
        "work",
      ),
    ).toBe(true);
    expect(
      isUnknownSessionError(
        new HerdrHttpError(404, "404 not found", "not found"),
        "work",
      ),
    ).toBe(false);
  });

  it("forwards reply cancellation to the request", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: URL, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });
    const controller = new AbortController();
    const reply = transport.reply("pane-1", { text: "continue", requestId: "request-3" }, controller.signal);

    controller.abort();

    await expect(reply).rejects.toBeDefined();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails clearly instead of attempting an unsupported cross-origin web connection", async () => {
    vi.stubGlobal("location", { origin: "http://localhost:8081" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });

    await expect(transport.snapshot()).rejects.toThrow(/same-origin Herdr bridge/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed successful bridge responses before they reach app state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response("{}"))));
    const transport = new HerdrHttpTransport({ baseUrl: "https://buildbox.example.ts.net" });

    await expect(transport.snapshot()).rejects.toThrow(/incompatible response/);
    await expect(transport.pane("pane-1")).rejects.toThrow(/incompatible response/);
    await expect(transport.reply("pane-1", { text: "continue", requestId: "request-4" })).rejects.toThrow(/incompatible response/);
  });
});
