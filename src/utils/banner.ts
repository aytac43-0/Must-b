const orange = (s: string) => `\x1b[38;2;234;88;12m${s}\x1b[0m`;
const amber  = (s: string) => `\x1b[38;2;245;158;11m${s}\x1b[0m`;
const white  = (s: string) => `\x1b[97m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;

// ── ASCII logo ─────────────────────────────────────────────────────────────
const ASCII = `
 ███╗   ███╗██╗   ██╗███████╗████████╗      ██████╗
 ████╗ ████║██║   ██║██╔════╝╚══██╔══╝      ██╔══██╗
 ██╔████╔██║██║   ██║███████╗   ██║█████╗   ██████╔╝
 ██║╚██╔╝██║██║   ██║╚════██║   ██║╚════╝   ██╔══██╗
 ██║ ╚═╝ ██║╚██████╔╝███████║   ██║         ██████╔╝
 ╚═╝     ╚═╝ ╚═════╝ ╚══════╝   ╚═╝         ╚═════╝ `;

// Injected by esbuild `--define` at build time; fall back gracefully in tsx dev.
declare const __VERSION__: string;
declare const __GIT_HASH__: string;

function readVersion(): string {
  try { return typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0'; }
  catch { return '1.0.0'; }
}

function readHash(): string {
  try { return typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : ''; }
  catch { return ''; }
}

function center(text: string, width = 58): string {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, Math.floor((width - stripped.length) / 2));
  return ' '.repeat(pad) + text;
}

function divider(ch = '─', width = 58): string {
  return dim('  ' + ch.repeat(width));
}

export function printBanner(mode: string, port: number): void {
  const version = readVersion();
  const hash    = readHash();

  // ── Logo ────────────────────────────────────────────────────────────────
  console.log(orange(ASCII));

  // ── Identity ────────────────────────────────────────────────────────────
  console.log('');
  console.log(center(
    bold(white('Must-b')) + '  ' + amber('v' + version)
  ));
  console.log(center(dim('Professional AI Operating System')));
  console.log('');

  // ── Vision taglines ─────────────────────────────────────────────────────
  console.log(center(orange('⚡ Autonomous · Precise · Always On')));
  console.log(center(
    dim('Vision') + dim(' · ') +
    dim('Voice')  + dim(' · ') +
    dim('OS Control') + dim(' · ') +
    dim('Multi-Agent Hierarchy')
  ));

  // ── Divider ─────────────────────────────────────────────────────────────
  console.log('');
  console.log(divider());
  console.log('');

  // ── Runtime info ────────────────────────────────────────────────────────
  const meta = [
    `Node ${process.version}`,
    `Mode: ${mode.toUpperCase()}`,
    `PID ${process.pid}`,
    hash ? `#${hash}` : null,
  ].filter(Boolean).join(dim(' · '));

  console.log(center(dim(meta)));

  if (mode === 'web') {
    console.log('');
    console.log(center(green('▶  ') + amber(`http://localhost:${port}`)));
    console.log(center(dim('Dashboard is live — open in your browser')));
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  console.log('');
  console.log(divider());
  console.log(center(dim('Built by Auto Step  ·  https://must-b.com')));
  console.log('');
}
