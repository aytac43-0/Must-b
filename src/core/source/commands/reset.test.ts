import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNonExitingRuntime } from "../runtime.js";

const resolveCleanupPlanFromDisk = vi.fn();
const removePath = vi.fn();
const listAgentSessionDirs = vi.fn();
const removeStateAndLinkedPaths = vi.fn();
const removeWorkspaceDirs = vi.fn();

vi.mock("../config/config.js", () => ({
  isNixMode: false,
}));

vi.mock("./cleanup-plan.js", () => ({
  resolveCleanupPlanFromDisk,
}));

vi.mock("./cleanup-utils.js", () => ({
  removePath,
  listAgentSessionDirs,
  removeStateAndLinkedPaths,
  removeWorkspaceDirs,
}));

const { resetCommand } = await import("./reset.js");

describe("resetCommand", () => {
  const runtime = createNonExitingRuntime();

  beforeEach(() => {
    vi.clearAllMocks();
    resolveCleanupPlanFromDisk.mockReturnValue({
      stateDir: "/tmp/.must-b",
      configPath: "/tmp/.must-b/must-b.json",
      oauthDir: "/tmp/.must-b/credentials",
      configInsideState: true,
      oauthInsideState: true,
      workspaceDirs: ["/tmp/.must-b/workspace"],
    });
    removePath.mockResolvedValue({ ok: true });
    listAgentSessionDirs.mockResolvedValue(["/tmp/.must-b/agents/main/sessions"]);
    removeStateAndLinkedPaths.mockResolvedValue(undefined);
    removeWorkspaceDirs.mockResolvedValue(undefined);
    vi.spyOn(runtime, "log").mockImplementation(() => {});
    vi.spyOn(runtime, "error").mockImplementation(() => {});
  });

  it("recommends creating a backup before state-destructive reset scopes", async () => {
    await resetCommand(runtime, {
      scope: "config+creds+sessions",
      yes: true,
      nonInteractive: true,
      dryRun: true,
    });

    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("must-b backup create"));
  });

  it("does not recommend backup for config-only reset", async () => {
    await resetCommand(runtime, {
      scope: "config",
      yes: true,
      nonInteractive: true,
      dryRun: true,
    });

    expect(runtime.log).not.toHaveBeenCalledWith(expect.stringContaining("must-b backup create"));
  });
});
