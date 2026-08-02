import { describe, expect, it } from "vitest";
import {
  draftAfterAmbiguousResolution,
  nextPendingSend,
  type PendingSend,
} from "./sendState";

const attempt: PendingSend = {
  requestId: "request-1",
  text: "continue",
  submittedDraft: "continue",
  submitOnly: false,
};

describe("nextPendingSend", () => {
  it("retains the original id and blocks automatic retry after ambiguous delivery", () => {
    expect(
      nextPendingSend(
        attempt,
        { ok: false, error: "inspect the pane", textDelivered: true, deliveryAmbiguous: true },
        () => "request-2",
      ),
    ).toEqual({ ...attempt, ambiguous: true });
  });

  it("creates a submit-only retry only for a definitive key failure", () => {
    expect(
      nextPendingSend(
        attempt,
        { ok: false, error: "keys rejected", textDelivered: true },
        () => "request-2",
      ),
    ).toEqual({
      requestId: "request-2",
      text: "",
      submittedDraft: "",
      submitOnly: true,
    });
  });

  it("clears completed attempts", () => {
    expect(nextPendingSend(attempt, { ok: true }, () => "request-2")).toBeNull();
  });

  it("restores retained text only when the operator says delivery did not arrive", () => {
    const unresolved = { ...attempt, ambiguous: true as const };
    expect(draftAfterAmbiguousResolution("", unresolved, true)).toBe("continue");
    expect(draftAfterAmbiguousResolution("", unresolved, false)).toBe("");
  });
});
