/**
 * Must-b Filesystem Tool (v2.0) — Full Suite
 *
 * Sandboxed file operations confined to workspaceRoot.
 * Operations: read, write, append, delete, list (recursive), search (grep),
 *             patch (string replace), stat, copy, move.
 */

import fsSync from 'fs';
import fs     from 'fs/promises';
import path   from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReadParams   { path: string; encoding?: BufferEncoding; offset?: number; limit?: number; }
export interface WriteParams  { path: string; content: string; encoding?: BufferEncoding; }
export interface AppendParams { path: string; content: string; encoding?: BufferEncoding; }
export interface DeleteParams { path: string; recursive?: boolean; }
export interface ListParams   { path?: string; recursive?: boolean; maxDepth?: number; pattern?: string; }
export interface SearchParams { path?: string; pattern: string; recursive?: boolean; caseSensitive?: boolean; maxResults?: number; }
export interface PatchParams  { path: string; oldString: string; newString: string; replaceAll?: boolean; }
export interface StatParams   { path: string; }
export interface CopyParams   { src: string; dest: string; overwrite?: boolean; }
export interface MoveParams   { src: string; dest: string; }

export interface FileEntry {
  name:    string;
  path:    string;
  type:    'file' | 'dir';
  size?:   number;
}

export interface SearchResult {
  file:   string;
  line:   number;
  text:   string;
}

export interface MarkdownSection {
  heading:  string;
  level:    number;  // 1–6 (H1–H6); 0 = content before first heading
  content:  string;
}

// ── FilesystemTools ────────────────────────────────────────────────────────

export class FilesystemTools {
  private root: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.root = path.resolve(workspaceRoot);
  }

  private safe(target: string): string {
    const resolved = path.resolve(this.root, target);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error(`[filesystem] Path traversal blocked: "${target}"`);
    }
    return resolved;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  async readFile(params: ReadParams): Promise<string> {
    const p = this.safe(params.path);
    const content = await fs.readFile(p, { encoding: params.encoding ?? 'utf-8' });
    if (params.offset !== undefined || params.limit !== undefined) {
      const lines = content.split('\n');
      const start = params.offset ?? 0;
      const end   = params.limit  !== undefined ? start + params.limit : undefined;
      return lines.slice(start, end).join('\n');
    }
    return content;
  }

  // ── Write ───────────────────────────────────────────────────────────────

  async writeFile(params: WriteParams): Promise<string> {
    const p = this.safe(params.path);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, params.content, { encoding: params.encoding ?? 'utf-8' });
    return `Written: ${params.path}`;
  }

  // ── Append ──────────────────────────────────────────────────────────────

  async appendFile(params: AppendParams): Promise<string> {
    const p = this.safe(params.path);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.appendFile(p, params.content, { encoding: params.encoding ?? 'utf-8' });
    return `Appended to: ${params.path}`;
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async deleteFile(params: DeleteParams): Promise<string> {
    const p = this.safe(params.path);
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      await fs.rm(p, { recursive: params.recursive ?? false, force: true });
      return `Deleted directory: ${params.path}`;
    }
    await fs.unlink(p);
    return `Deleted: ${params.path}`;
  }

  // ── List ────────────────────────────────────────────────────────────────

  async listFiles(params: ListParams = {}): Promise<FileEntry[]> {
    const base     = this.safe(params.path ?? '.');
    const results: FileEntry[] = [];
    const maxDepth = params.maxDepth ?? (params.recursive ? 8 : 1);

    const walk = async (dir: string, depth: number) => {
      if (depth > maxDepth) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (/^(node_modules|\.git|dist|\.hf-cache)$/.test(e.name)) continue;
        const full = path.join(dir, e.name);
        const rel  = path.relative(this.root, full);
        if (params.pattern && !rel.includes(params.pattern)) continue;
        const entry: FileEntry = { name: e.name, path: rel, type: e.isDirectory() ? 'dir' : 'file' };
        if (!e.isDirectory()) {
          try { entry.size = (await fs.stat(full)).size; } catch { /* ignore */ }
        }
        results.push(entry);
        if (e.isDirectory() && (params.recursive || depth < 1)) await walk(full, depth + 1);
      }
    };

    await walk(base, 0);
    return results;
  }

  // ── Search (grep-like) ───────────────────────────────────────────────────

  async searchFiles(params: SearchParams): Promise<SearchResult[]> {
    const base       = this.safe(params.path ?? '.');
    const flags      = params.caseSensitive ? '' : 'i';
    const re         = new RegExp(params.pattern, flags);
    const maxResults = params.maxResults ?? 200;
    const results:   SearchResult[] = [];

    const scan = async (dir: string) => {
      if (results.length >= maxResults) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= maxResults) break;
        if (/^(node_modules|\.git|dist|\.hf-cache)$/.test(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (params.recursive !== false) await scan(full);
        } else {
          try {
            const lines = (await fs.readFile(full, 'utf-8')).split('\n');
            lines.forEach((text, i) => {
              if (results.length < maxResults && re.test(text)) {
                results.push({ file: path.relative(this.root, full), line: i + 1, text: text.trim() });
              }
            });
          } catch { /* binary or unreadable — skip */ }
        }
      }
    };

    const stat = await fs.stat(base);
    if (stat.isDirectory()) await scan(base);
    else {
      const lines = (await fs.readFile(base, 'utf-8')).split('\n');
      lines.forEach((text, i) => {
        if (re.test(text)) results.push({ file: params.path!, line: i + 1, text: text.trim() });
      });
    }
    return results;
  }

  // ── Patch (string replace in file) ───────────────────────────────────────

  async patchFile(params: PatchParams): Promise<string> {
    const p       = this.safe(params.path);
    let   content = await fs.readFile(p, 'utf-8');
    if (!content.includes(params.oldString)) {
      throw new Error(`[filesystem] patchFile: oldString not found in ${params.path}`);
    }
    const updated = params.replaceAll
      ? content.split(params.oldString).join(params.newString)
      : content.replace(params.oldString, params.newString);
    await fs.writeFile(p, updated, 'utf-8');
    const count = params.replaceAll
      ? (content.match(new RegExp(params.oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
      : 1;
    return `Patched ${params.path} (${count} replacement${count !== 1 ? 's' : ''})`;
  }

  // ── Stat ────────────────────────────────────────────────────────────────

  async stat(params: StatParams): Promise<Record<string, unknown>> {
    const p = this.safe(params.path);
    const s = await fs.stat(p);
    return {
      path:       params.path,
      type:       s.isDirectory() ? 'dir' : 'file',
      size:       s.size,
      created:    s.birthtime.toISOString(),
      modified:   s.mtime.toISOString(),
      accessed:   s.atime.toISOString(),
    };
  }

  // ── Copy ────────────────────────────────────────────────────────────────

  async copy(params: CopyParams): Promise<string> {
    const src  = this.safe(params.src);
    const dest = this.safe(params.dest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const mode = params.overwrite === false
      ? fsSync.constants.COPYFILE_EXCL
      : 0;
    await fs.copyFile(src, dest, mode);
    return `Copied ${params.src} → ${params.dest}`;
  }

  // ── Move / Rename ────────────────────────────────────────────────────────

  async move(params: MoveParams): Promise<string> {
    const src  = this.safe(params.src);
    const dest = this.safe(params.dest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    return `Moved ${params.src} → ${params.dest}`;
  }

  // ── JSON Smart Operations (v1.23.4) ──────────────────────────────────────

  /**
   * Read and parse a JSON file.
   * Throws a clear error if the file is not valid JSON.
   */
  async readJson<T = unknown>(params: { path: string }): Promise<T> {
    const p   = this.safe(params.path);
    const raw = await fs.readFile(p, 'utf-8');
    try {
      return JSON.parse(raw) as T;
    } catch (e: any) {
      throw new Error(`[filesystem] readJson: invalid JSON in "${params.path}" — ${e.message}`);
    }
  }

  /**
   * Serialize data and write it to a JSON file.
   * indent: spaces for pretty-printing (default 2).
   */
  async writeJson(params: { path: string; data: unknown; indent?: number }): Promise<string> {
    const p       = this.safe(params.path);
    const indent  = params.indent ?? 2;
    const content = JSON.stringify(params.data, null, indent) + '\n';
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, 'utf-8');
    return `JSON written: ${params.path}`;
  }

  /**
   * Set a value at a dot-notation key path inside a JSON file.
   * Missing intermediate objects are created automatically.
   * Example: key "user.preferences.theme", value "dark"
   */
  async patchJson(params: { path: string; key: string; value: unknown; indent?: number }): Promise<string> {
    const p   = this.safe(params.path);
    let data: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(p, 'utf-8');
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* file missing or empty — start fresh */ }

    const parts = params.key.split('.');
    let node: Record<string, unknown> = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
      node = node[k] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = params.value;

    const indent  = params.indent ?? 2;
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(data, null, indent) + '\n', 'utf-8');
    return `JSON patched: ${params.path} → ${params.key}`;
  }

  // ── Markdown Smart Operations (v1.23.4) ──────────────────────────────────

  /**
   * Read a Markdown file and return its sections split by headings.
   * Each section: { heading, level (1-6), content }.
   * Content that appears before the first heading gets level 0 / heading "".
   */
  async readMarkdown(params: { path: string }): Promise<{ sections: MarkdownSection[] }> {
    const p    = this.safe(params.path);
    const raw  = await fs.readFile(p, 'utf-8');
    const lines = raw.split('\n');

    const sections: MarkdownSection[] = [];
    let currentHeading = '';
    let currentLevel   = 0;
    let currentLines:  string[] = [];

    const flush = () => {
      const content = currentLines.join('\n').trim();
      if (content || currentHeading) {
        sections.push({ heading: currentHeading, level: currentLevel, content });
      }
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        flush();
        currentHeading = headingMatch[2].trim();
        currentLevel   = headingMatch[1].length;
        currentLines   = [];
      } else {
        currentLines.push(line);
      }
    }
    flush();

    return { sections };
  }

  /**
   * Append a new Markdown section (heading + content) to a file.
   * If the file doesn't exist it is created.
   * level: heading depth 1–6 (default 2 = ##).
   */
  async appendMarkdownSection(params: {
    path:     string;
    heading:  string;
    content:  string;
    level?:   number;
  }): Promise<string> {
    const p      = this.safe(params.path);
    const hashes = '#'.repeat(Math.max(1, Math.min(6, params.level ?? 2)));
    const block  = `\n${hashes} ${params.heading}\n\n${params.content.trimEnd()}\n`;
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.appendFile(p, block, 'utf-8');
    return `Markdown section appended to ${params.path}: "${params.heading}"`;
  }
}
