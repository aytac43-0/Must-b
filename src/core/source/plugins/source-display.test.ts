import path from "node:path";
import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import { formatPluginSourceForTable, resolvePluginSourceRoots } from "./source-display.js";

describe("formatPluginSourceForTable", () => {
  it("shortens bundled plugin sources under the stock root", () => {
    const stockRoot = path.resolve(
      path.sep,
      "opt",
      "homebrew",
      "lib",
      "node_modules",
      "must-b",
      "extensions",
    );
    const globalRoot = path.resolve(path.sep, "Users", "x", ".must-b", "extensions");
    const workspaceRoot = path.resolve(path.sep, "Users", "x", "ws", ".must-b", "extensions");
    const out = formatPluginSourceForTable(
      {
        origin: "bundled",
        source: path.join(stockRoot, "bluebubbles", "index.ts"),
      },
      {
        stock: stockRoot,
        global: globalRoot,
        workspace: workspaceRoot,
      },
    );
    expect(out.value).toBe("stock:bluebubbles/index.ts");
    expect(out.rootKey).toBe("stock");
  });

  it("shortens workspace plugin sources under the workspace root", () => {
    const stockRoot = path.resolve(
      path.sep,
      "opt",
      "homebrew",
      "lib",
      "node_modules",
      "must-b",
      "extensions",
    );
    const globalRoot = path.resolve(path.sep, "Users", "x", ".must-b", "extensions");
    const workspaceRoot = path.resolve(path.sep, "Users", "x", "ws", ".must-b", "extensions");
    const out = formatPluginSourceForTable(
      {
        origin: "workspace",
        source: path.join(workspaceRoot, "matrix", "index.ts"),
      },
      {
        stock: stockRoot,
        global: globalRoot,
        workspace: workspaceRoot,
      },
    );
    expect(out.value).toBe("workspace:matrix/index.ts");
    expect(out.rootKey).toBe("workspace");
  });

  it("shortens global plugin sources under the global root", () => {
    const stockRoot = path.resolve(
      path.sep,
      "opt",
      "homebrew",
      "lib",
      "node_modules",
      "must-b",
      "extensions",
    );
    const globalRoot = path.resolve(path.sep, "Users", "x", ".must-b", "extensions");
    const workspaceRoot = path.resolve(path.sep, "Users", "x", "ws", ".must-b", "extensions");
    const out = formatPluginSourceForTable(
      {
        origin: "global",
        source: path.join(globalRoot, "zalo", "index.js"),
      },
      {
        stock: stockRoot,
        global: globalRoot,
        workspace: workspaceRoot,
      },
    );
    expect(out.value).toBe("global:zalo/index.js");
    expect(out.rootKey).toBe("global");
  });

  it("resolves source roots from an explicit env override", () => {
    const ignoredHome = path.resolve(path.sep, "tmp", "ignored-home");
    const homeDir = path.resolve(path.sep, "tmp", "must-b-home");
    const roots = withEnv(
      {
        MUSTB_BUNDLED_PLUGINS_DIR: path.join(ignoredHome, "ignored-bundled"),
        MUSTB_STATE_DIR: path.join(ignoredHome, "ignored-state"),
        HOME: ignoredHome,
      },
      () =>
        resolvePluginSourceRoots({
          env: {
            ...process.env,
            HOME: homeDir,
            MUSTB_BUNDLED_PLUGINS_DIR: "~/bundled",
            MUSTB_STATE_DIR: "~/state",
          },
          workspaceDir: "~/ws",
        }),
    );

    expect(roots).toEqual({
      stock: path.join(homeDir, "bundled"),
      global: path.join(homeDir, "state", "extensions"),
      workspace: path.join(homeDir, "ws", ".must-b", "extensions"),
    });
  });
});
