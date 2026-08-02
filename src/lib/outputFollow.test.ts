import { describe, expect, it } from "vitest";
import { isOutputNearBottom } from "./outputFollow";

describe("isOutputNearBottom", () => {
  it("follows when the viewport is at or close to the end", () => {
    expect(isOutputNearBottom(700, 300, 1_000)).toBe(true);
    expect(isOutputNearBottom(660, 300, 1_000)).toBe(true);
  });

  it("stops following when the reader scrolls into history", () => {
    expect(isOutputNearBottom(500, 300, 1_000)).toBe(false);
  });
});
