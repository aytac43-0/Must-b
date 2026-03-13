import {
  resolveSessionStoreTargets,
  type SessionStoreSelectionOptions,
  type SessionStoreTarget,
} from "../config/sessions.js";
import type { Must-bConfig } from "../config/types.must-b.js";
import type { RuntimeEnv } from "../runtime.js";
export { resolveSessionStoreTargets, type SessionStoreSelectionOptions, type SessionStoreTarget };

export function resolveSessionStoreTargetsOrExit(params: {
  cfg: Must-bConfig;
  opts: SessionStoreSelectionOptions;
  runtime: RuntimeEnv;
}): SessionStoreTarget[] | null {
  try {
    return resolveSessionStoreTargets(params.cfg, params.opts);
  } catch (error) {
    params.runtime.error(error instanceof Error ? error.message : String(error));
    params.runtime.exit(1);
    return null;
  }
}
