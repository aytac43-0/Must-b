import type { Must-bConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: Must-bConfig, pluginId: string): Must-bConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}
