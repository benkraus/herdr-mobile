import { describe, expect, it, vi } from "vitest";
import { TerminalInputQueue } from "./terminalInputQueue";
import type { ActionResponse } from "./types";

describe("terminal input delivery queue", () => {
  it("coalesces repeated submits before a render and while waiting behind typed input", async () => {
    const pending = vi.fn();
    const queue = new TerminalInputQueue(pending);
    let acknowledgeInput!: (result: ActionResponse) => void;
    const input = queue.run(
      "pane",
      () =>
        new Promise((resolve) => {
          acknowledgeInput = resolve;
        }),
    );
    const send = vi.fn().mockResolvedValue({ ok: true });
    const first = queue.submit("pane", send);
    const repeated = queue.submit("pane", send);
    expect(repeated).toBe(first);
    expect(pending.mock.calls.at(-1)).toEqual([{ pane: 2 }]);
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
    acknowledgeInput({ ok: true });
    await Promise.all([input, first, repeated]);
    expect(send).toHaveBeenCalledOnce();
    await queue.submit("pane", send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("releases the submit guard after rejection and isolates other panes", async () => {
    const queue = new TerminalInputQueue(() => {});
    const send = vi.fn().mockRejectedValue(new Error("unconfirmed"));
    const first = queue.submit("pane", send);
    expect(queue.submit("pane", send)).toBe(first);
    await expect(first).rejects.toThrow("unconfirmed");
    send.mockResolvedValue({ ok: true });
    const a = queue.submit("pane", send);
    const b = queue.submit("other", send);
    expect(a).not.toBe(b);
    await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("reports pending writes immediately and keeps text before its submit key", async () => {
    const pending = vi.fn();
    const queue = new TerminalInputQueue(pending);
    let acknowledge!: (result: ActionResponse) => void;
    const text = queue.run(
      "pane",
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    const sendKey = vi.fn().mockResolvedValue({ ok: true });
    const key = queue.run("pane", sendKey);
    expect(pending.mock.calls.at(-1)).toEqual([{ pane: 2 }]);
    await Promise.resolve();
    expect(sendKey).not.toHaveBeenCalled();
    acknowledge({ ok: true });
    await Promise.all([text, key]);
    expect(sendKey).toHaveBeenCalledOnce();
    expect(pending.mock.calls.at(-1)).toEqual([{}]);
  });

  it.each([false, true])(
    "cancels queued keys after a failed input (throw=%s), without replaying",
    async (throws) => {
      const pending = vi.fn();
      const queue = new TerminalInputQueue(pending);
      const sendText = vi.fn(async (): Promise<ActionResponse> => {
        if (throws) throw new Error("acknowledgment lost");
        return { ok: false, error: "read only" };
      });
      const text = queue.run("pane", sendText).catch(() => undefined);
      const sendKey = vi.fn().mockResolvedValue({ ok: true });
      const key = queue.run("pane", sendKey);
      await text;
      await expect(key).resolves.toMatchObject({ ok: false, cancelled: true });
      expect(sendKey).not.toHaveBeenCalled();
      expect(sendText).toHaveBeenCalledOnce();
      expect(pending.mock.calls.at(-1)).toEqual([{}]);
      await expect(queue.run("pane", sendKey)).resolves.toEqual({ ok: true });
    },
  );

  it("keeps pending counts scoped to the destination pane", async () => {
    const pending = vi.fn();
    const queue = new TerminalInputQueue(pending);
    const a = queue.run("a", async () => ({ ok: true }));
    const b = queue.run("b", async () => ({ ok: true }));
    expect(pending.mock.calls.at(-1)).toEqual([{ a: 1, b: 1 }]);
    await Promise.all([a, b]);
    expect(pending.mock.calls.at(-1)).toEqual([{}]);
  });
});
