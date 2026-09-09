import { act, createElement } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHerdrConnection, usePaneOutput } from "./useHerdrConnection";
import type { HerdrLiveEvent } from "../lib/transport";
import type { PaneReadResponse } from "../lib/types";

const mocks = vi.hoisted(() => ({
  appStateListener: null as null | ((state: string) => void),
  remove: vi.fn(),
  snapshot: vi.fn(),
  input: vi.fn(),
  reconnect: vi.fn(),
  watchPane: vi.fn(),
  close: vi.fn(),
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListener = listener;
      return { remove: mocks.remove };
    },
  },
}));
vi.mock("../lib/storage", () => ({
  loadConnection: async () => ({ baseUrl: "https://host.example" }),
  saveConnection: async () => {},
}));
vi.mock("../lib/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/transport")>()),
  HerdrHttpTransport: class {
    snapshot = mocks.snapshot;
    input = mocks.input;
    subscribeLive() {
      return {
        reconnect: mocks.reconnect,
        close: mocks.close,
        watchPane: mocks.watchPane,
        scrollPane: vi.fn(),
      };
    }
  },
}));

let root: ReactTestRenderer | undefined;
async function mount<T>(hook: () => T) {
  let current!: T;
  function Probe() {
    current = hook();
    return null;
  }
  await act(async () => {
    root = create(createElement(Probe));
  });
  return () => current;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.snapshot.mockResolvedValue({
    bridge: "connected",
    agents: [],
    shellPanes: [],
    workspaces: [],
    tabs: [],
    sessions: [],
    ts: 1,
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("foreground recovery", () => {
  it("isolates pending input when switching connections", async () => {
    const current = await mount(useHerdrConnection);
    let finishOld!: (value: { ok: false; error: string }) => void;
    mocks.input.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    let oldWrite!: Promise<unknown>;
    await act(async () => {
      oldWrite = current().sendInput("pane", "old");
    });
    expect(current().pendingInput).toEqual({ pane: 1 });
    await act(async () => {
      await current().connect({ baseUrl: "https://other.example" });
    });
    expect(current().pendingInput).toEqual({});
    mocks.input.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await expect(current().sendInput("pane", "new")).resolves.toEqual({ ok: true });
    });
    await act(async () => {
      finishOld({ ok: false, error: "old connection failed" });
      await oldWrite;
    });
    expect(current().pendingInput).toEqual({});
    expect(mocks.input).toHaveBeenCalledTimes(2);
  });

  it("reconnects and refreshes immediately after suspension, aborting a stale read", async () => {
    const current = await mount(useHerdrConnection);
    let staleSignal: AbortSignal | undefined;
    mocks.snapshot.mockImplementationOnce((signal: AbortSignal) => {
      staleSignal = signal;
      return new Promise(() => {});
    });
    await act(async () => {
      void current().refresh();
    });
    const reads = mocks.snapshot.mock.calls.length;
    await act(async () => {
      mocks.appStateListener?.("background");
      mocks.appStateListener?.("active");
    });
    expect(staleSignal?.aborted).toBe(true);
    expect(mocks.reconnect).toHaveBeenCalledOnce();
    expect(mocks.snapshot.mock.calls.length).toBeGreaterThan(reads);
    expect(current().mode).toBe("live");
  });

  it("does not reconnect for repeated active notifications", async () => {
    await mount(useHerdrConnection);
    await act(async () => {
      mocks.appStateListener?.("active");
    });
    expect(mocks.reconnect).not.toHaveBeenCalled();
  });
});

describe("terminal frame authority", () => {
  const size = { cols: 80, rows: 24 };
  const fullFrame = {
    type: "pane_frame",
    paneId: "pane",
    seq: 1,
    full: true,
    width: 80,
    height: 24,
    text: "fresh frame",
  } as const;

  it.each([false, true])(
    "ignores a REST response/error overtaken by a frame (error=%s)",
    async (fail) => {
      let resolve!: (value: PaneReadResponse) => void;
      let reject!: (reason: Error) => void;
      const read = vi.fn(
        () =>
          new Promise<PaneReadResponse>((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      );
      let listener!: (
        event: Extract<HerdrLiveEvent, { type: "pane_frame" | "pane_output_changed" }>,
      ) => void;
      const subscribe = vi.fn((_pane, _size, next) => {
        listener = next;
        return () => {};
      });
      const current = await mount(() =>
        usePaneOutput("pane", "live", "host", read, subscribe, false, size),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(read).toHaveBeenCalledOnce();
      await act(async () => {
        listener(fullFrame);
      });
      await act(async () => {
        if (fail) reject(new Error("old timeout"));
        else resolve({ paneId: "pane", text: "stale REST", revision: 999, truncated: false });
      });
      expect(current().output?.text).toBe("fresh frame");
      expect(current().error).toBeNull();
    },
  );

  it("does not start REST reads for output notices while native frames are live", async () => {
    const read = vi.fn();
    let listener!: (
      event: Extract<HerdrLiveEvent, { type: "pane_frame" | "pane_output_changed" }>,
    ) => void;
    const subscribe = vi.fn((_pane, _size, next) => {
      listener = next;
      return () => {};
    });
    await mount(() => usePaneOutput("pane", "live", "host", read, subscribe, false, size));
    await act(async () => {
      listener(fullFrame);
      listener({ type: "pane_output_changed", paneId: "pane", revision: 500 });
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(read).not.toHaveBeenCalled();
  });
});
