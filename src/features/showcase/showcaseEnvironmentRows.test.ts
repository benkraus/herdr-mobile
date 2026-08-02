import { EnvironmentId } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";

import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import {
  applyShowcaseLocalEnvironmentDisplayUrls,
  resolveShowcaseEnvironmentUpdateDisplayUrl,
} from "./showcaseEnvironmentRows";

function environment(
  environmentId: string,
  environmentLabel: string,
  displayUrl = "http://127.0.0.1:3773/",
): ConnectedEnvironmentSummary {
  return {
    environmentId: EnvironmentId.make(environmentId),
    environmentLabel,
    displayUrl,
    isRelayManaged: false,
    connectionState: "connected",
    connectionError: null,
    connectionErrorTraceId: null,
  };
}

it("presents showcase transports as remote endpoints", () => {
  const environments = applyShowcaseLocalEnvironmentDisplayUrls([
    environment("runtime-id-1", "Moonbase Terminal"),
    environment("runtime-id-2", "Suspense Station"),
    environment("runtime-id-3", "Kernel Cabin"),
  ]);

  assert.deepStrictEqual(
    environments.map(({ displayUrl }) => displayUrl),
    [
      "https://moonbase.example.test/",
      "https://suspense-vps.hel1.t3.sh/",
      "http://relay.example.test:3773/",
    ],
  );
});

it("leaves environments outside the showcase fixture unchanged", () => {
  const original = environment(
    "runtime-id-4",
    "My Workstation",
    "https://workstation.example.test/",
  );

  assert.deepStrictEqual(applyShowcaseLocalEnvironmentDisplayUrls([original]), [original]);
});

it("does not persist a cosmetic showcase URL when only the label is saved", () => {
  assert.equal(
    resolveShowcaseEnvironmentUpdateDisplayUrl({
      actualDisplayUrl: "http://127.0.0.1:3773/",
      presentedDisplayUrl: "https://moonbase.example.test/",
      submittedDisplayUrl: "https://moonbase.example.test/",
    }),
    "http://127.0.0.1:3773/",
  );
  assert.equal(
    resolveShowcaseEnvironmentUpdateDisplayUrl({
      actualDisplayUrl: "http://127.0.0.1:3773/",
      presentedDisplayUrl: "https://moonbase.example.test/",
      submittedDisplayUrl: "https://new-host.example.com/",
    }),
    "https://new-host.example.com/",
  );
});
