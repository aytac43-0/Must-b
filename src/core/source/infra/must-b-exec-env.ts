export const MUSTB_CLI_ENV_VAR = "MUSTB_CLI";
export const MUSTB_CLI_ENV_VALUE = "1";

export function markMust-bExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [MUSTB_CLI_ENV_VAR]: MUSTB_CLI_ENV_VALUE,
  };
}

export function ensureMust-bExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[MUSTB_CLI_ENV_VAR] = MUSTB_CLI_ENV_VALUE;
  return env;
}
