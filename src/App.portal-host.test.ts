import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Android overlay portal wiring", () => {
  it("mounts the overlay host at the application root", () => {
    const appSource = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

    expect(appSource).toContain('import { OverlayPortalHost } from "./components/OverlayPortal";');
    expect(appSource).toContain("<OverlayPortalHost />");
  });
});
