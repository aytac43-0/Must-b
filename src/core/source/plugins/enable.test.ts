import { describe, expect, it } from "vitest";
import type { Must-bConfig } from "../config/config.js";
import { enablePluginInConfig } from "./enable.js";

describe("enablePluginInConfig", () => {
  it("enables a plugin entry", () => {
    const cfg: Must-bConfig = {};
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.entries?.["google-gemini-cli-auth"]?.enabled).toBe(true);
  });

  it("adds plugin to allowlist when allowlist is configured", () => {
    const cfg: Must-bConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "google-gemini-cli-auth"]);
  });

  it("refuses enable when plugin is denylisted", () => {
    const cfg: Must-bConfig = {
      plugins: {
        deny: ["google-gemini-cli-auth"],
      },
    };
    const result = enablePluginInConfig(cfg, "google-gemini-cli-auth");
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("blocked by denylist");
  });

  it("writes built-in channels to channels.<id>.enabled and plugins.entries", () => {
    const cfg: Must-bConfig = {};
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.telegram?.enabled).toBe(true);
  });

  it("adds built-in channel id to allowlist when allowlist is configured", () => {
    const cfg: Must-bConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    };
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.allow).toEqual(["memory-core", "telegram"]);
  });

  it("re-enables built-in channels after explicit plugin-level disable", () => {
    const cfg: Must-bConfig = {
      channels: {
        telegram: {
          enabled: true,
        },
      },
      plugins: {
        entries: {
          telegram: {
            enabled: false,
          },
        },
      },
    };
    const result = enablePluginInConfig(cfg, "telegram");
    expect(result.enabled).toBe(true);
    expect(result.config.channels?.telegram?.enabled).toBe(true);
    expect(result.config.plugins?.entries?.telegram?.enabled).toBe(true);
  });
});
