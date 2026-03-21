import type {
  AnyAgentTool,
  MustBPluginApi,
  MustBPluginToolFactory,
} from "must-b/plugin-sdk/lobster";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: MustBPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as MustBPluginToolFactory,
    { optional: true },
  );
}
