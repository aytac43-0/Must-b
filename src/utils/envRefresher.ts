/**
 * envRefresher.ts — Windows PATH Refresher
 *
 * After winget (or any installer) writes new entries to the system/user
 * PATH in the registry, the current Node.js process doesn't see them
 * because process.env.PATH was inherited from the parent shell at startup.
 *
 * refreshEnvironmentPath() re-reads the registry and updates process.env.PATH
 * in-process so that subsequent spawn/spawnSync calls can find newly installed
 * executables without the user restarting their terminal.
 *
 * Two-attempt strategy (Windows only):
 *   Attempt 1 — PowerShell:
 *     Reads Machine + User PATH via [System.Environment]::GetEnvironmentVariable.
 *     Most reliable; covers REG_EXPAND_SZ expansion.
 *     Bypasses execution policy with -ExecutionPolicy Bypass.
 *
 *   Attempt 2 — reg query (fallback):
 *     Used when PowerShell is blocked by a Group Policy execution restriction.
 *     Reads HKLM and HKCU PATH values directly via the `reg` CLI and merges them.
 *
 * On Linux / macOS: no-op (PATH is managed by the shell and is already correct).
 */

import { spawnSync } from 'child_process';

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Merge two semicolon-delimited PATH strings.
 * Duplicate entries (case-insensitive on Windows) are removed; order is preserved.
 */
function mergePaths(base: string, extra: string): string {
  const seen = new Set<string>();
  return [base, extra]
    .join(';')
    .split(';')
    .map(p => p.trim())
    .filter(p => {
      if (!p) return false;
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(';');
}

/**
 * Read a PATH value from the Windows registry using `reg query`.
 * Returns an empty string on any failure so callers never throw.
 *
 * @param hive  Full registry key, e.g.
 *              'HKLM\\System\\CurrentControlSet\\Control\\Session Manager\\Environment'
 * @param name  Value name, typically 'Path'
 */
function regQueryPath(hive: string, name: string): string {
  try {
    const r = spawnSync('reg', ['query', hive, '/v', name], {
      encoding: 'utf8',
      timeout:  6000,
      shell:    false,
    });
    if (r.status !== 0 || !r.stdout) return '';
    // Output line format:
    //   "    Path    REG_EXPAND_SZ    C:\Windows\system32;..."
    const match = r.stdout.match(/REG_(?:EXPAND_SZ|SZ)\s+(.+)/i);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Refresh process.env.PATH from the Windows registry.
 *
 * Call this immediately after a winget / installer invocation to make newly
 * added executables visible to subsequent spawn() calls in the same process.
 *
 * Safe to call on Linux / macOS — returns immediately without side-effects.
 */
export function refreshEnvironmentPath(): void {
  if (process.platform !== 'win32') return;

  // ── Attempt 1: PowerShell ────────────────────────────────────────────────
  // Reads and merges Machine + User PATH through the .NET API (handles
  // REG_EXPAND_SZ expansion automatically).  -ExecutionPolicy Bypass ensures
  // this runs even when the system policy is Restricted or AllSigned.
  try {
    const psScript = [
      '$m = [System.Environment]::GetEnvironmentVariable("Path", "Machine");',
      '$u = [System.Environment]::GetEnvironmentVariable("Path", "User");',
      '$merged = ($m + ";" + $u).Split(";") | ForEach-Object { $_.Trim() }',
      '  | Where-Object { $_ -ne "" } | Select-Object -Unique;',
      'Write-Output ($merged -join ";")',
    ].join(' ');

    const r = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { encoding: 'utf8', timeout: 8000, shell: false },
    );

    if (r.status === 0 && r.stdout?.trim()) {
      process.env.PATH = r.stdout.trim();
      return; // ✓ done
    }
  } catch { /* fall through to reg query */ }

  // ── Attempt 2: reg query (execution-policy-safe fallback) ────────────────
  // Works even when PowerShell scripts are fully blocked by Group Policy.
  const machinePath = regQueryPath(
    'HKLM\\System\\CurrentControlSet\\Control\\Session Manager\\Environment',
    'Path',
  );
  const userPath = regQueryPath('HKCU\\Environment', 'Path');

  const merged = mergePaths(
    machinePath || process.env.PATH || '',
    userPath,
  );

  if (merged) {
    process.env.PATH = merged;
  }
  // If both attempts yield nothing, leave process.env.PATH unchanged —
  // better to keep the stale PATH than to wipe it entirely.
}
