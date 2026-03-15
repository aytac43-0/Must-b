import type { MustBPluginApi } from "must-b/plugin-sdk/synology-chat";
import { emptyPluginConfigSchema } from "must-b/plugin-sdk/synology-chat";
import { createSynologyChatPlugin } from "./src/channel.js";
import { setSynologyRuntime } from "./src/runtime.js";

const plugin = {
  id: "synology-chat",
  name: "Synology Chat",
  description: "Native Synology Chat channel plugin for Must-b",
  configSchema: emptyPluginConfigSchema(),
  register(api: MustBPluginApi) {
    setSynologyRuntime(api.runtime);
    api.registerChannel({ plugin: createSynologyChatPlugin() });
  },
};

export default plugin;
