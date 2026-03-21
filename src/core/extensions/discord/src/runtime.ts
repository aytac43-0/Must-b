import { createPluginRuntimeStore } from "must-b/plugin-sdk/compat";
import type { PluginRuntime } from "must-b/plugin-sdk/discord";

const { setRuntime: setDiscordRuntime, getRuntime: getDiscordRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Discord runtime not initialized");
export { getDiscordRuntime, setDiscordRuntime };
