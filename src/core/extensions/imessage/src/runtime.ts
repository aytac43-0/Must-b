import { createPluginRuntimeStore } from "must-b/plugin-sdk/compat";
import type { PluginRuntime } from "must-b/plugin-sdk/imessage";

const { setRuntime: setIMessageRuntime, getRuntime: getIMessageRuntime } =
  createPluginRuntimeStore<PluginRuntime>("iMessage runtime not initialized");
export { getIMessageRuntime, setIMessageRuntime };
