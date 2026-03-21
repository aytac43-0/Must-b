import type { MustBPluginApi } from "must-b/plugin-sdk/googlechat";
import { emptyPluginConfigSchema } from "must-b/plugin-sdk/googlechat";
import { googlechatDock, googlechatPlugin } from "./src/channel.js";
import { setGoogleChatRuntime } from "./src/runtime.js";

const plugin = {
  id: "googlechat",
  name: "Google Chat",
  description: "Must-b Google Chat channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: MustBPluginApi) {
    setGoogleChatRuntime(api.runtime);
    api.registerChannel({ plugin: googlechatPlugin, dock: googlechatDock });
  },
};

export default plugin;
