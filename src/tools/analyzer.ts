import fs from 'fs/promises';
import path from 'path';

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
}

const EXCLUDED = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vscode']);

export class ProjectAnalyzer {
  private root: string;

  constructor(root: string = process.cwd()) {
    this.root = path.resolve(root);
  }

  async tree(dir?: string, depth: number = 4): Promise<DirectoryNode> {
    const target = dir ? path.resolve(this.root, dir) : this.root;
    return this.walk(target, depth);
  }

  private async walk(current: string, depth: number): Promise<DirectoryNode> {
    const name = path.basename(current);
    const stat = await fs.stat(current);

    if (stat.isFile()) return { name, type: 'file' };

    if (depth <= 0 || EXCLUDED.has(name)) {
      return { name, type: 'directory', children: [] };
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    const children: DirectoryNode[] = [];
    for (const e of entries) {
      if (EXCLUDED.has(e.name)) continue;
      children.push(await this.walk(path.join(current, e.name), depth - 1));
    }
    return { name, type: 'directory', children };
  }

  async readSummary(dir?: string): Promise<string> {
    const target = dir ? path.resolve(this.root, dir) : this.root;
    let summary = '';
    for (const f of ['README.md', 'package.json']) {
      try {
        const content = await fs.readFile(path.join(target, f), 'utf-8');
        summary += `--- ${f} ---\n${content.slice(0, 2000)}\n\n`;
      } catch { /* skip if not found */ }
    }
    return summary || 'No README.md or package.json found.';
  }
}
