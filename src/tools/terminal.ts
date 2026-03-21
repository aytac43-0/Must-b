import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export interface TerminalParams {
  command: string;
  cwd?: string;
}

export class TerminalTools {
  private allowedCommands = ['npm', 'node', 'ls', 'dir', 'echo', 'mkdir', 'git', 'tsc'];

  async execute(params: TerminalParams): Promise<string> {
    const command = params.command.trim();
    const cmdRoot = command.split(' ')[0];

    // Basic security filter (in a real system, this would be more robust/sandboxed)
    // For now, we allow generic commands but warn about risks.
    // Ideally, whitelist specific commands or run in a container.
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        cwd: params.cwd || process.cwd(),
        timeout: 10000 
      });

      if (stderr) {
        return `Output: ${stdout}\nStderr: ${stderr}`;
      }
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message} \nStderr: ${error.stderr}`);
    }
  }
}
