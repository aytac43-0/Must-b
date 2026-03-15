const orange = (s: string) => `\x1b[38;2;234;88;12m${s}\x1b[0m`;
const amber  = (s: string) => `\x1b[38;2;245;158;11m${s}\x1b[0m`;
const white  = (s: string) => `\x1b[97m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const ASCII = `
 ███╗   ███╗██╗   ██╗███████╗████████╗      ██████╗
 ████╗ ████║██║   ██║██╔════╝╚══██╔══╝      ██╔══██╗
 ██╔████╔██║██║   ██║███████╗   ██║█████╗   ██████╔╝
 ██║╚██╔╝██║██║   ██║╚════██║   ██║╚════╝   ██╔══██╗
 ██║ ╚═╝ ██║╚██████╔╝███████║   ██║         ██████╔╝
 ╚═╝     ╚═╝ ╚═════╝ ╚══════╝   ╚═╝         ╚═════╝ `;

function center(text: string, width = 56): string {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, Math.floor((width - stripped.length) / 2));
  return ' '.repeat(pad) + text;
}

export function printBanner(mode: string, port: number) {
  console.log(orange(ASCII));
  console.log('');
  console.log(center(bold(white('Must-b')) + amber('  —  Your Personal AI Brain')));
  console.log(center(orange('⚡ AI SYSTEM')));
  console.log(center(dim('Created by Mustafa Aytaç ÖZTAN  —  Auto Step Edition')));
  console.log('');
  console.log(center(dim(`Node ${process.version}  ·  Mode: ${mode}  ·  PID: ${process.pid}`)));
  if (mode === 'web') {
    console.log(center(orange(`→ http://localhost:${port}`)));
  }
  console.log('');
  console.log(center(dim('Must-b is a proprietary AI platform developed by Mustafa Aytaç ÖZTAN under the Auto Step brand.')));
  console.log('');
}
