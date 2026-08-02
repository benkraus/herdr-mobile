import type { ActionResponse } from "../../lib/types";

export interface PendingSend {
  requestId: string;
  text: string;
  submittedDraft: string;
  submitOnly: boolean;
  /** Terminal delivery may have happened; require inspection instead of issuing another write. */
  ambiguous?: true;
}

export function nextPendingSend(
  attempt: PendingSend,
  result: ActionResponse,
  createRequestId: () => string,
): PendingSend | null {
  if (result.ok) return null;
  if (result.cancelled) return attempt;
  if (result.deliveryAmbiguous) return { ...attempt, ambiguous: true };
  if (result.textDelivered && !attempt.submitOnly) {
    return {
      requestId: createRequestId(),
      text: "",
      submittedDraft: "",
      submitOnly: true,
    };
  }
  if (attempt.submitOnly) return { ...attempt, requestId: createRequestId() };
  return null;
}

export function draftAfterAmbiguousResolution(
  currentDraft: string,
  attempt: PendingSend,
  restore: boolean,
): string {
  return restore && attempt.ambiguous ? attempt.submittedDraft : currentDraft;
}
