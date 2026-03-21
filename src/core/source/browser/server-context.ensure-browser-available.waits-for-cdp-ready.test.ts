import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./server-context.chrome-test-harness.js";
import * as chromeModule from "./chrome.js";
import type { RunningChrome } from "./chrome.js";
import type { BrowserServerState } from "./server-context.js";
import { createBrowserRouteContext } from "./server-context.js";

function makeBrowserState(): BrowserServerState {
  return {
    // oxlint-disable-next-line typescript/no-explicit-any
    server: null as any,
    port: 0,
    resolved: {
      enabled: true,
      controlPort: 18791,
      cdpProtocol: "http",
      cdpHost: "127.0.0.1",
      cdpIsLoopback: true,
      cdpPortRangeStart: 18800,
      cdpPortRangeEnd: 18810,
      evaluateEnabled: false,
      remoteCdpTimeoutMs: 1500,
      remoteCdpHandshakeTimeoutMs: 3000,
      extraArgs: [],
      color: "#FF4500",
      headless: true,
      noSandbox: false,
      attachOnly: false,
      ssrfPolicy: { allowPrivateNetwork: true },
      defaultProfile: "must-b",
      profiles: {
        must-b: { cdpPort: 18800, color: "#FF4500" },
      },
    },
    profiles: new Map(),
  };
}

function mockLaunchedChrome(
  launchMustBhrome: { mockResolvedValue: (value: RunningChrome) => unknown },
  pid: number,
) {
  const proc = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
  launchMustBhrome.mockResolvedValue({
    pid,
    exe: { kind: "chromium", path: "/usr/bin/chromium" },
    userDataDir: "/tmp/must-b-test",
    cdpPort: 18800,
    startedAt: Date.now(),
    proc,
  });
}

function setupEnsureBrowserAvailableHarness() {
  vi.useFakeTimers();

  const launchMustBhrome = vi.mocked(chromeModule.launchMustBhrome);
  const stopMustBhrome = vi.mocked(chromeModule.stopMustBhrome);
  const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
  const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);
  isChromeReachable.mockResolvedValue(false);

  const state = makeBrowserState();
  const ctx = createBrowserRouteContext({ getState: () => state });
  const profile = ctx.forProfile("must-b");

  return { launchMustBhrome, stopMustBhrome, isChromeCdpReady, profile };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("browser server-context ensureBrowserAvailable", () => {
  it("waits for CDP readiness after launching to avoid follow-up PortInUseError races (#21149)", async () => {
    const { launchMustBhrome, stopMustBhrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLaunchedChrome(launchMustBhrome, 123);

    const promise = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(launchMustBhrome).toHaveBeenCalledTimes(1);
    expect(isChromeCdpReady).toHaveBeenCalled();
    expect(stopMustBhrome).not.toHaveBeenCalled();
  });

  it("stops launched chrome when CDP readiness never arrives", async () => {
    const { launchMustBhrome, stopMustBhrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(false);
    mockLaunchedChrome(launchMustBhrome, 321);

    const promise = profile.ensureBrowserAvailable();
    const rejected = expect(promise).rejects.toThrow("not reachable after start");
    await vi.advanceTimersByTimeAsync(8100);
    await rejected;

    expect(launchMustBhrome).toHaveBeenCalledTimes(1);
    expect(stopMustBhrome).toHaveBeenCalledTimes(1);
  });
});
