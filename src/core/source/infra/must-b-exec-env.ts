export const MUSTB_CLI_ENV_VAR = "MUSTB_CLI";
export const MUSTB_CLI_ENV_VALUE = "1";

export function markMustBxecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [MUSTB_CLI_ENV_VAR]: MUSTB_CLI_ENV_VALUE,
  };
}

export function ensureMustBxecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[MUSTB_CLI_ENV_VAR] = MUSTB_CLI_ENV_VALUE;
  return env;
}
