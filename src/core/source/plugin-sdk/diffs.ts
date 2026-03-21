// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export type { MustBonfig } from "../config/config.js";
export { resolvePreferredMustBmpDir } from "../infra/tmp-must-b-dir.js";
export type {
  AnyAgentTool,
  MustBluginApi,
  MustBluginConfigSchema,
  PluginLogger,
} from "../plugins/types.js";
