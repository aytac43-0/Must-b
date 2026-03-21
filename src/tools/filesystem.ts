import fs from 'fs/promises';
import path from 'path';

export interface FileToolParams {
  path: string;
  content?: string;
  encoding?: BufferEncoding;
}

export class FilesystemTools {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  private validatePath(targetPath: string): string {
    const resolvedPath = path.resolve(this.workspaceRoot, targetPath);
    if (!resolvedPath.startsWith(this.workspaceRoot)) {
      throw new Error(`Security Error: Access denied to path outside workspace: ${targetPath}`);
    }
    return resolvedPath;
  }

  async readFile(params: FileToolParams): Promise<string> {
    const safePath = this.validatePath(params.path);
    return await fs.readFile(safePath, { encoding: params.encoding || 'utf-8' });
  }

  async writeFile(params: FileToolParams): Promise<string> {
    if (!params.content) throw new Error('writeFile requires content');
    const safePath = this.validatePath(params.path);
    
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, params.content, { encoding: params.encoding || 'utf-8' });
    return `Successfully wrote to ${params.path}`;
  }

  async listFiles(params: FileToolParams): Promise<string[]> {
    const safePath = this.validatePath(params.path || '.');
    const files = await fs.readdir(safePath);
    return files;
  }
}
