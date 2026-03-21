import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          MUSTB_STATE_DIR: "/tmp/must-b-state",
          MUSTB_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "must-b-gateway",
        windowsTaskName: "Must-b Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/must-b-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/must-b-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "must-b-gateway",
        windowsTaskName: "Must-b Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u must-b-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "must-b-gateway",
        windowsTaskName: "Must-b Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "Must-b Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "must-b gateway install",
        startCommand: "must-b gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.must-b.gateway.plist",
        systemdServiceName: "must-b-gateway",
        windowsTaskName: "Must-b Gateway",
      }),
    ).toEqual([
      "must-b gateway install",
      "must-b gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.must-b.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "must-b gateway install",
        startCommand: "must-b gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.must-b.gateway.plist",
        systemdServiceName: "must-b-gateway",
        windowsTaskName: "Must-b Gateway",
      }),
    ).toEqual([
      "must-b gateway install",
      "must-b gateway",
      "systemctl --user start must-b-gateway.service",
    ]);
  });
});
