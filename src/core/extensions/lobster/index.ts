import type {
  AnyAgentTool,
  Must-bPluginApi,
  Must-bPluginToolFactory,
} from "must-b/plugin-sdk/lobster";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: Must-bPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as Must-bPluginToolFactory,
    { optional: true },
  );
}
