import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerdrHttpTransport } from "./transport";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(); // Deliberately never emits onclose, like a stalled native socket.
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  open() {
    this.readyState = Socket.OPEN;
    this.onopen?.();
  }
  receive(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

const frame = (seq: number, full = true, paneId = "pane") => ({
  type: "pane_frame",
  paneId,
  seq,
  full,
  width: 80,
  height: 24,
  bytes: "aGk=",
});
const subscribe = () => {
  const listener = vi.fn();
  const subscription = new HerdrHttpTransport({
    baseUrl: "https://host.example",
    session: "work",
  }).subscribeLive(listener);
  subscription.watchPane("pane", { cols: 80, rows: 24 });
  return { listener, subscription, socket: Socket.instances[0]! };
};

beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live connection recovery", () => {
  it("recovers a connection that never opens or closes", async () => {
    const { subscription, socket, listener } = subscribe();
    await vi.advanceTimersByTimeAsync(10_500);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(Socket.instances).toHaveLength(2);
    expect(listener).toHaveBeenCalledWith({
      type: "pane_stream_status",
      paneId: "pane",
      live: false,
    });
    Socket.instances[1]!.open();
    expect(Socket.instances[1]!.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "watch_pane",
        paneId: "pane",
        cols: 80,
        rows: 24,
      }),
    );
    subscription.close();
  });

  it("recovers an error without waiting for a native close callback", async () => {
    const { subscription, socket } = subscribe();
    socket.onerror?.();
    await vi.advanceTimersByTimeAsync(500);
    expect(Socket.instances).toHaveLength(2);
    subscription.close();
  });

  it("renews a silently stalled pane even while other panes publish events", async () => {
    const { subscription, socket } = subscribe();
    socket.open();
    socket.receive(frame(1));
    await vi.advanceTimersByTimeAsync(20_000);
    socket.receive({ type: "pane_output_changed", paneId: "other", revision: 99 });
    await vi.advanceTimersByTimeAsync(10_500);
    expect(Socket.instances).toHaveLength(2);
    subscription.close();
  });

  it("keeps a progressing stream alive", async () => {
    const { subscription, socket } = subscribe();
    socket.open();
    socket.receive(frame(1));
    await vi.advanceTimersByTimeAsync(25_000);
    socket.receive(frame(2, false));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(Socket.instances).toHaveLength(1);
    subscription.close();
  });

  it.each(["gap", "missing bootstrap"])("requests a full frame after %s", async (scenario) => {
    const { subscription, socket, listener } = subscribe();
    socket.open();
    if (scenario === "gap") socket.receive(frame(1));
    listener.mockClear();
    socket.receive(frame(3, false));
    expect(listener.mock.calls.some(([event]) => event.type === "pane_frame")).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(Socket.instances).toHaveLength(2);
    subscription.close();
  });

  it("ignores callbacks from a replaced socket and reconnects immediately on request", async () => {
    const { subscription, socket, listener } = subscribe();
    const lateMessage = socket.onmessage;
    const lateClose = socket.onclose;
    subscription.reconnect();
    listener.mockClear();
    lateMessage?.({ data: JSON.stringify(frame(1)) });
    lateClose?.();
    expect(listener).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(2);
    subscription.close();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(Socket.instances).toHaveLength(2);
  });

  it("recovers send failures without throwing into the UI", async () => {
    const { subscription, socket } = subscribe();
    socket.open();
    socket.send.mockImplementation(() => {
      throw new Error("network gone");
    });
    expect(() => subscription.watchPane("next")).not.toThrow();
    await vi.advanceTimersByTimeAsync(500);
    expect(Socket.instances).toHaveLength(2);
    subscription.close();
  });
});
