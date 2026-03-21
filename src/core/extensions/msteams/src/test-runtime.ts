import os from "node:os";
import path from "node:path";
import type { PluginRuntime } from "must-b/plugin-sdk/msteams";

export const msteamsRuntimeStub = {
  state: {
    resolveStateDir: (env: NodeJS.ProcessEnv = process.env, homedir?: () => string) => {
      const override = env.MUSTB_STATE_DIR?.trim() || env.MUSTB_STATE_DIR?.trim();
      if (override) {
        return override;
      }
      const resolvedHome = homedir ? homedir() : os.homedir();
      return path.join(resolvedHome, ".must-b");
    },
  },
} as unknown as PluginRuntime;
