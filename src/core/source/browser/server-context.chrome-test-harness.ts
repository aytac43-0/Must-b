import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/must-b" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchMust-bChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveMust-bUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopMust-bChrome: vi.fn(async () => {}),
}));
