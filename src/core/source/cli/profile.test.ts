import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "must-b",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "must-b", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "must-b", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "must-b", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "must-b", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "must-b", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "must-b", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "must-b", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "must-b", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".must-b-dev");
    expect(env.MUSTB_PROFILE).toBe("dev");
    expect(env.MUSTB_STATE_DIR).toBe(expectedStateDir);
    expect(env.MUSTB_CONFIG_PATH).toBe(path.join(expectedStateDir, "must-b.json"));
    expect(env.MUSTB_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      MUSTB_STATE_DIR: "/custom",
      MUSTB_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.MUSTB_STATE_DIR).toBe("/custom");
    expect(env.MUSTB_GATEWAY_PORT).toBe("19099");
    expect(env.MUSTB_CONFIG_PATH).toBe(path.join("/custom", "must-b.json"));
  });

  it("uses MUSTB_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      MUSTB_HOME: "/srv/must-b-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/must-b-home");
    expect(env.MUSTB_STATE_DIR).toBe(path.join(resolvedHome, ".must-b-work"));
    expect(env.MUSTB_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".must-b-work", "must-b.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "must-b doctor --fix",
      env: {},
      expected: "must-b doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "must-b doctor --fix",
      env: { MUSTB_PROFILE: "default" },
      expected: "must-b doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "must-b doctor --fix",
      env: { MUSTB_PROFILE: "Default" },
      expected: "must-b doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "must-b doctor --fix",
      env: { MUSTB_PROFILE: "bad profile" },
      expected: "must-b doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "must-b --profile work doctor --fix",
      env: { MUSTB_PROFILE: "work" },
      expected: "must-b --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "must-b --dev doctor",
      env: { MUSTB_PROFILE: "dev" },
      expected: "must-b --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("must-b doctor --fix", { MUSTB_PROFILE: "work" })).toBe(
      "must-b --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("must-b doctor --fix", { MUSTB_PROFILE: "  jbmust-b  " })).toBe(
      "must-b --profile jbmust-b doctor --fix",
    );
  });

  it("handles command with no args after must-b", () => {
    expect(formatCliCommand("must-b", { MUSTB_PROFILE: "test" })).toBe(
      "must-b --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm must-b doctor", { MUSTB_PROFILE: "work" })).toBe(
      "pnpm must-b --profile work doctor",
    );
  });
});
