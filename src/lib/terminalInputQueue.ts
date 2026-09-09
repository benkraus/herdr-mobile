import type { ActionResponse } from "./types";

/** Keep input ordered and cancel the already-queued suffix if an earlier write fails. */
export class TerminalInputQueue {
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;
  private pending: Record<string, number> = {};
  private submissions = new Map<string, Promise<ActionResponse>>();

  constructor(private readonly onPending: (pending: Record<string, number>) => void) {}

  submit(paneId: string, operation: () => Promise<ActionResponse>): Promise<ActionResponse> {
    const pending = this.submissions.get(paneId);
    if (pending) return pending;
    const result = this.run(paneId, operation).finally(() => this.submissions.delete(paneId));
    // Claim the submission synchronously, including time spent waiting behind queued keystrokes.
    this.submissions.set(paneId, result);
    return result;
  }

  run(paneId: string, operation: () => Promise<ActionResponse>): Promise<ActionResponse> {
    const generation = this.generation;
    this.updatePending(paneId, 1);
    const result = this.tail
      .then(async () => {
        if (generation !== this.generation) {
          return {
            ok: false as const,
            cancelled: true,
            error:
              "Queued input cancelled after an earlier input failed. Check the pane before continuing.",
          };
        }
        try {
          const response = await operation();
          if (!response.ok) this.generation += 1;
          return response;
        } catch (reason) {
          this.generation += 1;
          throw reason;
        }
      })
      .finally(() => this.updatePending(paneId, -1));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private updatePending(paneId: string, delta: number) {
    const next = { ...this.pending, [paneId]: (this.pending[paneId] ?? 0) + delta };
    if (!next[paneId]) delete next[paneId];
    this.pending = next;
    this.onPending(next);
  }
}
