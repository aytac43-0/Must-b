import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePluginProviders } from "./providers.js";

const loadMustBluginsMock = vi.fn();

vi.mock("./loader.js", () => ({
  loadMustBlugins: (...args: unknown[]) => loadMustBluginsMock(...args),
}));

describe("resolvePluginProviders", () => {
  beforeEach(() => {
    loadMustBluginsMock.mockReset();
    loadMustBluginsMock.mockReturnValue({
      providers: [{ provider: { id: "demo-provider" } }],
    });
  });

  it("forwards an explicit env to plugin loading", () => {
    const env = { MUSTB_HOME: "/srv/must-b-home" } as NodeJS.ProcessEnv;

    const providers = resolvePluginProviders({
      workspaceDir: "/workspace/explicit",
      env,
    });

    expect(providers).toEqual([{ id: "demo-provider" }]);
    expect(loadMustBluginsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceDir: "/workspace/explicit",
        env,
      }),
    );
  });
});
