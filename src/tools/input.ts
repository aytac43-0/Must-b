/**
 * Must-b OS-Level Input Simulation — Precision Hands (v4.2)
 *
 * Provides cross-platform mouse positioning, clicking and human-paced typing.
 * No hierarchy restriction — available on all tiers.
 *
 * Events fired on inputEvents (subscribe from api.ts → forward to socket.io):
 *   'mouseMove'  { x, y }
 *   'mouseClick' { x, y, button }
 *   'typeText'   { preview }          ← first 60 chars of typed text
 *   'visionClick'{ x, y, type, label }← element found via detectUIElements
 */

import { execFile, spawn }   from 'child_process';
import { promisify }          from 'util';
import { writeFile, unlink }  from 'fs/promises';
import { tmpdir }             from 'os';
import { join }               from 'path';
import { EventEmitter }       from 'events';

export const inputEvents = new EventEmitter();

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Platform helpers ───────────────────────────────────────────────────────

/** Run a PowerShell script safely via a temp .ps1 file (avoids all quoting hell). */
async function runPS(script: string): Promise<void> {
  const tmp = join(tmpdir(), `mustb-input-${Date.now()}.ps1`);
  await writeFile(tmp, script, 'utf8');
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp,
    ], { windowsHide: true });
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** Run a shell command on mac/linux. */
async function sh(cmd: string, args: string[]): Promise<void> {
  await execFileAsync(cmd, args);
}

// ── Mouse Move ────────────────────────────────────────────────────────────

/**
 * Move the OS cursor to (x, y) — true OS-level, works across all apps.
 */
export async function osMouseMove(x: number, y: number): Promise<void> {
  inputEvents.emit('mouseMove', { x, y });

  switch (process.platform) {
    case 'win32':
      await runPS(`
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
`);
      break;

    case 'darwin':
      // cliclick first (most reliable), fall back to AppleScript
      await sh('cliclick', [`m:${x},${y}`]).catch(() =>
        sh('osascript', [
          '-e',
          `tell application "System Events" to set the position of the mouse cursor to {${x}, ${y}}`,
        ])
      );
      break;

    default:
      await sh('xdotool', ['mousemove', String(x), String(y)]);
  }
}

// ── Mouse Click ───────────────────────────────────────────────────────────

const WIN_BUTTON_FLAGS: Record<string, [number, number]> = {
  left:   [0x0002, 0x0004],   // LEFTDOWN / LEFTUP
  right:  [0x0008, 0x0010],   // RIGHTDOWN / RIGHTUP
  middle: [0x0020, 0x0040],   // MIDDLEDOWN / MIDDLEUP
};

/**
 * Move the OS cursor to (x, y) and fire a mouse button click.
 * button defaults to 'left'.
 */
export async function osMouseClick(
  x:      number,
  y:      number,
  button: 'left' | 'right' | 'middle' = 'left',
): Promise<void> {
  inputEvents.emit('mouseClick', { x, y, button });

  switch (process.platform) {
    case 'win32': {
      const [dn, up] = WIN_BUTTON_FLAGS[button];
      await runPS(`
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$memberDef = '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);'
$type = Add-Type -MemberDefinition $memberDef -Name 'MBInput' -Namespace 'MustB' -PassThru -ErrorAction SilentlyContinue
if ($type -eq $null) { $type = [MustB.MBInput] }
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
$type::mouse_event(${dn}, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 40
$type::mouse_event(${up}, 0, 0, 0, [UIntPtr]::Zero)
`);
      break;
    }

    case 'darwin': {
      const cliBtn = button === 'right' ? 'rc' : button === 'middle' ? 'tc' : 'c';
      await sh('cliclick', [`${cliBtn}:${x},${y}`]).catch(() => {
        const appleBtn = button === 'right' ? 'right click' : 'click';
        return sh('osascript', [
          '-e',
          `tell application "System Events" to ${appleBtn} at {${x}, ${y}}`,
        ]);
      });
      break;
    }

    default: {
      const btn = button === 'right' ? 3 : button === 'middle' ? 2 : 1;
      await sh('xdotool', ['mousemove', String(x), String(y), 'click', String(btn)]);
    }
  }
}

// ── Keyboard Typing ───────────────────────────────────────────────────────

/**
 * Type text character by character with human-paced delay (default 60 ms ± 40%).
 * Uses the OS clipboard trick on Windows (faster and more reliable for long strings).
 */
export async function osTypeText(text: string, delayMs = 60): Promise<void> {
  inputEvents.emit('typeText', { preview: text.slice(0, 60) });

  switch (process.platform) {
    case 'win32':
      // Use clipboard paste for speed and reliability; Set-Clipboard → SendKeys ^v
      await runPS(`
Add-Type -AssemblyName System.Windows.Forms
Set-Clipboard -Value ${JSON.stringify(text)}
[System.Windows.Forms.SendKeys]::SendWait('^v')
`);
      break;

    case 'darwin':
      // pbcopy → ⌘V
      await new Promise<void>((resolve, reject) => {
        const pb = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] });
        pb.stdin?.write(text, 'utf8');
        pb.stdin?.end();
        pb.on('close', (code) => {
          code === 0 ? resolve() : reject(new Error(`pbcopy failed: ${code}`));
        });
      });
      await sh('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
      break;

    default:
      // xdotool type with configurable delay
      await sh('xdotool', ['type', `--delay`, String(delayMs), '--', text]);
  }

  // Human-like pause after typing
  await sleep(delayMs);
}

// ── Vision-Guided Click ───────────────────────────────────────────────────

/**
 * Detect UI elements in a base64 PNG and click the first element matching
 * the requested type (default 'button') at the given index (default 0).
 *
 * Returns the coordinates that were clicked plus the matched element, or null
 * if no element matched.
 */
export async function osVisionClick(params: {
  base64:      string;
  elementType?: 'button' | 'input' | 'image' | 'unknown';
  index?:       number;
  label?:       string;  // for logging only
}): Promise<{ ok: boolean; x?: number; y?: number; element?: object } | null> {
  const { detectUIElements } = await import('./vision.js');
  const { elements } = await detectUIElements(params.base64);

  const candidates = params.elementType
    ? elements.filter(e => e.type === params.elementType)
    : elements;

  const target = candidates[params.index ?? 0];
  if (!target) return { ok: false };

  const x = Math.round(target.x + target.width  / 2);
  const y = Math.round(target.y + target.height / 2);

  inputEvents.emit('visionClick', {
    x, y,
    type:  target.type,
    label: params.label ?? params.elementType ?? 'element',
  });

  await osMouseClick(x, y);
  return { ok: true, x, y, element: target };
}
