import { createPluginRuntimeStore } from "must-b/plugin-sdk/compat";
import type { PluginRuntime } from "must-b/plugin-sdk/signal";

const { setRuntime: setSignalRuntime, getRuntime: getSignalRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Signal runtime not initialized");
export { getSignalRuntime, setSignalRuntime };
