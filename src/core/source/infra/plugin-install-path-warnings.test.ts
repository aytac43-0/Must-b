import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempHome } from "../../test/helpers/temp-home.js";
import {
  detectPluginInstallPathIssue,
  formatPluginInstallPathIssue,
} from "./plugin-install-path-warnings.js";

describe("plugin install path warnings", () => {
  it("detects stale custom plugin install paths", async () => {
    const issue = await detectPluginInstallPathIssue({
      pluginId: "matrix",
      install: {
        source: "path",
        sourcePath: "/tmp/must-b-matrix-missing",
        installPath: "/tmp/must-b-matrix-missing",
      },
    });

    expect(issue).toEqual({
      kind: "missing-path",
      pluginId: "matrix",
      path: "/tmp/must-b-matrix-missing",
    });
    expect(
      formatPluginInstallPathIssue({
        issue: issue!,
        pluginLabel: "Matrix",
        defaultInstallCommand: "must-b plugins install @must-b/matrix",
        repoInstallCommand: "must-b plugins install ./extensions/matrix",
      }),
    ).toEqual([
      "Matrix is installed from a custom path that no longer exists: /tmp/must-b-matrix-missing",
      'Reinstall with "must-b plugins install @must-b/matrix".',
      'If you are running from a repo checkout, you can also use "must-b plugins install ./extensions/matrix".',
    ]);
  });

  it("detects active custom plugin install paths", async () => {
    await withTempHome(async (home) => {
      const pluginPath = path.join(home, "matrix-plugin");
      await fs.mkdir(pluginPath, { recursive: true });

      const issue = await detectPluginInstallPathIssue({
        pluginId: "matrix",
        install: {
          source: "path",
          sourcePath: pluginPath,
          installPath: pluginPath,
        },
      });

      expect(issue).toEqual({
        kind: "custom-path",
        pluginId: "matrix",
        path: pluginPath,
      });
    });
  });
});
