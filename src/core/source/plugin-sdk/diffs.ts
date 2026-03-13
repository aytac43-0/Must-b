// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export type { Must-bConfig } from "../config/config.js";
export { resolvePreferredMust-bTmpDir } from "../infra/tmp-must-b-dir.js";
export type {
  AnyAgentTool,
  Must-bPluginApi,
  Must-bPluginConfigSchema,
  PluginLogger,
} from "../plugins/types.js";
