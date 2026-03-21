import { createPluginRuntimeStore } from "must-b/plugin-sdk/compat";
import type { PluginRuntime } from "must-b/plugin-sdk/zalo";

const { setRuntime: setZaloRuntime, getRuntime: getZaloRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Zalo runtime not initialized");
export { getZaloRuntime, setZaloRuntime };
