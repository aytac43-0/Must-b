import type { MustBonfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: MustBonfig, pluginId: string): MustBonfig {
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
