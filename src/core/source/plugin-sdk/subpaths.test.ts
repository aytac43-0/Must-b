import * as compatSdk from "must-b/plugin-sdk/compat";
import * as discordSdk from "must-b/plugin-sdk/discord";
import * as imessageSdk from "must-b/plugin-sdk/imessage";
import * as lineSdk from "must-b/plugin-sdk/line";
import * as msteamsSdk from "must-b/plugin-sdk/msteams";
import * as signalSdk from "must-b/plugin-sdk/signal";
import * as slackSdk from "must-b/plugin-sdk/slack";
import * as telegramSdk from "must-b/plugin-sdk/telegram";
import * as whatsappSdk from "must-b/plugin-sdk/whatsapp";
import { describe, expect, it } from "vitest";

const bundledExtensionSubpathLoaders = [
  { id: "acpx", load: () => import("must-b/plugin-sdk/acpx") },
  { id: "bluebubbles", load: () => import("must-b/plugin-sdk/bluebubbles") },
  { id: "copilot-proxy", load: () => import("must-b/plugin-sdk/copilot-proxy") },
  { id: "device-pair", load: () => import("must-b/plugin-sdk/device-pair") },
  { id: "diagnostics-otel", load: () => import("must-b/plugin-sdk/diagnostics-otel") },
  { id: "diffs", load: () => import("must-b/plugin-sdk/diffs") },
  { id: "feishu", load: () => import("must-b/plugin-sdk/feishu") },
  {
    id: "google-gemini-cli-auth",
    load: () => import("must-b/plugin-sdk/google-gemini-cli-auth"),
  },
  { id: "googlechat", load: () => import("must-b/plugin-sdk/googlechat") },
  { id: "irc", load: () => import("must-b/plugin-sdk/irc") },
  { id: "llm-task", load: () => import("must-b/plugin-sdk/llm-task") },
  { id: "lobster", load: () => import("must-b/plugin-sdk/lobster") },
  { id: "matrix", load: () => import("must-b/plugin-sdk/matrix") },
  { id: "mattermost", load: () => import("must-b/plugin-sdk/mattermost") },
  { id: "memory-core", load: () => import("must-b/plugin-sdk/memory-core") },
  { id: "memory-lancedb", load: () => import("must-b/plugin-sdk/memory-lancedb") },
  {
    id: "minimax-portal-auth",
    load: () => import("must-b/plugin-sdk/minimax-portal-auth"),
  },
  { id: "nextcloud-talk", load: () => import("must-b/plugin-sdk/nextcloud-talk") },
  { id: "nostr", load: () => import("must-b/plugin-sdk/nostr") },
  { id: "open-prose", load: () => import("must-b/plugin-sdk/open-prose") },
  { id: "phone-control", load: () => import("must-b/plugin-sdk/phone-control") },
  { id: "qwen-portal-auth", load: () => import("must-b/plugin-sdk/qwen-portal-auth") },
  { id: "synology-chat", load: () => import("must-b/plugin-sdk/synology-chat") },
  { id: "talk-voice", load: () => import("must-b/plugin-sdk/talk-voice") },
  { id: "test-utils", load: () => import("must-b/plugin-sdk/test-utils") },
  { id: "thread-ownership", load: () => import("must-b/plugin-sdk/thread-ownership") },
  { id: "tlon", load: () => import("must-b/plugin-sdk/tlon") },
  { id: "twitch", load: () => import("must-b/plugin-sdk/twitch") },
  { id: "voice-call", load: () => import("must-b/plugin-sdk/voice-call") },
  { id: "zalo", load: () => import("must-b/plugin-sdk/zalo") },
  { id: "zalouser", load: () => import("must-b/plugin-sdk/zalouser") },
] as const;

describe("plugin-sdk subpath exports", () => {
  it("exports compat helpers", () => {
    expect(typeof compatSdk.emptyPluginConfigSchema).toBe("function");
    expect(typeof compatSdk.resolveControlCommandGate).toBe("function");
  });

  it("exports Discord helpers", () => {
    expect(typeof discordSdk.resolveDiscordAccount).toBe("function");
    expect(typeof discordSdk.inspectDiscordAccount).toBe("function");
    expect(typeof discordSdk.discordOnboardingAdapter).toBe("object");
  });

  it("exports Slack helpers", () => {
    expect(typeof slackSdk.resolveSlackAccount).toBe("function");
    expect(typeof slackSdk.inspectSlackAccount).toBe("function");
    expect(typeof slackSdk.handleSlackMessageAction).toBe("function");
  });

  it("exports Telegram helpers", () => {
    expect(typeof telegramSdk.resolveTelegramAccount).toBe("function");
    expect(typeof telegramSdk.inspectTelegramAccount).toBe("function");
    expect(typeof telegramSdk.telegramOnboardingAdapter).toBe("object");
  });

  it("exports Signal helpers", () => {
    expect(typeof signalSdk.resolveSignalAccount).toBe("function");
    expect(typeof signalSdk.signalOnboardingAdapter).toBe("object");
  });

  it("exports iMessage helpers", () => {
    expect(typeof imessageSdk.resolveIMessageAccount).toBe("function");
    expect(typeof imessageSdk.imessageOnboardingAdapter).toBe("object");
  });

  it("exports WhatsApp helpers", () => {
    expect(typeof whatsappSdk.resolveWhatsAppAccount).toBe("function");
    expect(typeof whatsappSdk.whatsappOnboardingAdapter).toBe("object");
  });

  it("exports LINE helpers", () => {
    expect(typeof lineSdk.processLineMessage).toBe("function");
    expect(typeof lineSdk.createInfoCard).toBe("function");
  });

  it("exports Microsoft Teams helpers", () => {
    expect(typeof msteamsSdk.resolveControlCommandGate).toBe("function");
    expect(typeof msteamsSdk.loadOutboundMediaFromUrl).toBe("function");
  });

  it("exports acpx helpers", async () => {
    const acpxSdk = await import("must-b/plugin-sdk/acpx");
    expect(typeof acpxSdk.listKnownProviderAuthEnvVarNames).toBe("function");
    expect(typeof acpxSdk.omitEnvKeysCaseInsensitive).toBe("function");
  });

  it("resolves bundled extension subpaths", async () => {
    for (const { id, load } of bundledExtensionSubpathLoaders) {
      const mod = await load();
      expect(typeof mod).toBe("object");
      expect(mod, `subpath ${id} should resolve`).toBeTruthy();
    }
  });

  it("keeps the newly added bundled plugin-sdk contracts available", async () => {
    const bluebubbles = await import("must-b/plugin-sdk/bluebubbles");
    expect(typeof bluebubbles.parseFiniteNumber).toBe("function");

    const mattermost = await import("must-b/plugin-sdk/mattermost");
    expect(typeof mattermost.parseStrictPositiveInteger).toBe("function");

    const nextcloudTalk = await import("must-b/plugin-sdk/nextcloud-talk");
    expect(typeof nextcloudTalk.waitForAbortSignal).toBe("function");

    const twitch = await import("must-b/plugin-sdk/twitch");
    expect(typeof twitch.DEFAULT_ACCOUNT_ID).toBe("string");
    expect(typeof twitch.normalizeAccountId).toBe("function");
  });
});
