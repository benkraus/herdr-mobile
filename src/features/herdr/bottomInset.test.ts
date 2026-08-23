import { describe, expect, it } from "vitest";

import { safeBottomInset } from "./bottomInset";

describe("safeBottomInset", () => {
  it("keeps Android content above the system bar while the keyboard is closed", () => {
    expect(safeBottomInset(0, "android", false)).toBe(48);
    expect(safeBottomInset(64, "android", false)).toBe(64);
  });

  it("does not reserve system-bar space above the Android keyboard", () => {
    expect(safeBottomInset(48, "android", true)).toBe(0);
  });

  it("preserves the reported inset on iOS", () => {
    expect(safeBottomInset(34, "ios", false)).toBe(34);
  });
});
