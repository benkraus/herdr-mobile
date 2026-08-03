import { describe, expect, it } from "vitest";

import { retainedRefreshMessage } from "./workspace-browser-model";

describe("retainedRefreshMessage", () => {
  it("warns when a failed refresh leaves previously loaded rows visible", () => {
    expect(retainedRefreshMessage("Relay unavailable.", true, "workspace files")).toBe(
      "Refresh failed. Showing previously loaded workspace files. Relay unavailable.",
    );
  });

  it("leaves initial and empty-state failures to the existing empty-state UI", () => {
    expect(retainedRefreshMessage("Relay unavailable.", false, "workspace files")).toBeNull();
    expect(retainedRefreshMessage(null, true, "workspace files")).toBeNull();
  });
});
