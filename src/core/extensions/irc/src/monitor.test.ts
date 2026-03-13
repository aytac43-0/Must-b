import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#must-b",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#must-b",
      rawTarget: "#must-b",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "must-b-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "must-b-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "must-b-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "must-b-bot",
      rawTarget: "must-b-bot",
    });
  });
});
