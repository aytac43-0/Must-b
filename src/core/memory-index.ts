/**
 * Must-b Memory Index (v4.7) — Elephant Memory
 *
 * Local semantic search powered by:
 *   • vectra   — lightweight on-disk vector index (memory/index/)
 *   • @huggingface/transformers — all-MiniLM-L6-v2, 384-dim, runs on-device
 *
 * Public API:
 *   indexDocument(text, metadata)  → stores embedding in local index
 *   queryMemory(query, topK?)      → returns ranked results
 *   autoIndexSkills()              → indexes all workspace/skills/*.json
 *   autoIndexWorkspace(dir?)       → indexes text files in workspace/
 *   getIndexStats()                → { items, sizeBytes }
 */

import fs   from 'fs';
import path from 'path';

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_ID  = 'Xenova/all-MiniLM-L6-v2';   // 384-dim, ~23 MB
const DIMS      = 384;
const MAX_CHUNK = 512;                           // characters per chunk

// ── Lazy index + pipeline ────────────────────────────────────────────────────

let _indexPromise:    Promise<import('vectra').LocalIndex>      | null = null;
let _pipelinePromise: Promise<(text: string) => Promise<number[]>> | null = null;

function indexDir(): string {
  const { WORKSPACE_ROOT } = require('./paths.js') as { WORKSPACE_ROOT: string };
  const dir = path.join(WORKSPACE_ROOT, 'index');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function getIndex(): Promise<import('vectra').LocalIndex> {
  if (!_indexPromise) {
    _indexPromise = (async () => {
      const { LocalIndex } = await import('vectra');
      const idx = new LocalIndex(indexDir());
      if (!await idx.isIndexCreated()) {
        await idx.createIndex();
      }
      return idx;
    })();
  }
  return _indexPromise;
}

async function getEmbedFn(): Promise<(text: string) => Promise<number[]>> {
  if (!_pipelinePromise) {
    _pipelinePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Cache models next to the index to avoid redownloading
      const { WORKSPACE_ROOT } = require('./paths.js') as { WORKSPACE_ROOT: string };
      env.cacheDir = path.join(WORKSPACE_ROOT, '.hf-cache');

      const pipe = await pipeline('feature-extraction', MODEL_ID, {
        // @ts-ignore — dtype available in recent versions
        dtype: 'fp32',
      });

      return async (text: string): Promise<number[]> => {
        const output = await (pipe as any)(text, { pooling: 'mean', normalize: true });
        // output.data is a Float32Array
        return Array.from(output.data as Float32Array);
      };
    })();
  }
  return _pipelinePromise;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoryMetadata {
  source:      'skill' | 'conversation' | 'workspace' | 'custom';
  title:       string;
  id?:         string;
  path?:       string;
  savedAt?:    string;
  tags?:       string[];
}

export interface MemoryResult {
  score:    number;
  text:     string;
  metadata: MemoryMetadata;
}

// ── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string, maxLen = MAX_CHUNK): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

// ── Core operations ──────────────────────────────────────────────────────────

/**
 * Index a text document. Long texts are split into chunks, each stored
 * separately with the same metadata + a chunk index.
 */
export async function indexDocument(
  text:     string,
  metadata: MemoryMetadata,
): Promise<void> {
  const [idx, embed] = await Promise.all([getIndex(), getEmbedFn()]);

  const chunks = chunkText(text.trim());
  for (let i = 0; i < chunks.length; i++) {
    const chunk  = chunks[i];
    const vector = await embed(chunk);
    await idx.insertItem({
      vector,
      metadata: {
        ...metadata,
        text:       chunk,
        chunkIndex: i,
        totalChunks: chunks.length,
      } as Record<string, unknown>,
    });
  }
}

/**
 * Semantic search over the memory index.
 * Returns up to `topK` results ranked by cosine similarity.
 */
export async function queryMemory(
  query:  string,
  topK:   number = 8,
): Promise<MemoryResult[]> {
  const [idx, embed] = await Promise.all([getIndex(), getEmbedFn()]);

  const vector  = await embed(query.trim());
  const results = await idx.queryItems(vector, topK);

  return results.map(r => {
    const m = r.item.metadata as Record<string, unknown>;
    return {
      score:    r.score,
      text:     String(m.text ?? ''),
      metadata: {
        source:  m.source  as MemoryMetadata['source'],
        title:   String(m.title  ?? ''),
        id:      m.id      ? String(m.id)   : undefined,
        path:    m.path    ? String(m.path)  : undefined,
        savedAt: m.savedAt ? String(m.savedAt) : undefined,
        tags:    Array.isArray(m.tags) ? m.tags as string[] : undefined,
      },
    };
  });
}

/**
 * Index all skills from workspace/skills/*.json
 */
export async function autoIndexSkills(): Promise<number> {
  const { listSkills } = await import('./skills-hub.js');
  const skills = listSkills();
  let count = 0;
  for (const skill of skills) {
    const text = [skill.name, skill.goal, skill.answer].filter(Boolean).join('\n\n');
    if (!text.trim()) continue;
    await indexDocument(text, {
      source:  'skill',
      title:   skill.name,
      id:      skill.id,
      savedAt: skill.savedAt,
      tags:    skill.tags,
    });
    count++;
  }
  return count;
}

/**
 * Index plain-text files in the workspace directory (up to maxFiles).
 */
export async function autoIndexWorkspace(
  dir?:     string,
  maxFiles: number = 50,
): Promise<number> {
  const { WORKSPACE_ROOT } = require('./paths.js') as { WORKSPACE_ROOT: string };
  const root = dir ?? WORKSPACE_ROOT;

  const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.csv', '.log', '.html', '.htm']);
  const MAX_BYTES = 100_000; // 100 KB per file

  let indexed = 0;

  function walk(d: string): string[] {
    if (indexed >= maxFiles) return [];
    let files: string[] = [];
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const abs = path.join(d, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(walk(abs));
        } else if (TEXT_EXTS.has(path.extname(entry.name).toLowerCase())) {
          files.push(abs);
        }
      }
    } catch { /* skip unreadable dirs */ }
    return files;
  }

  const files = walk(root).slice(0, maxFiles);

  for (const abs of files) {
    try {
      const stat = fs.statSync(abs);
      if (stat.size > MAX_BYTES) continue;
      const content = fs.readFileSync(abs, 'utf8');
      const rel     = path.relative(root, abs).replace(/\\/g, '/');
      await indexDocument(content, {
        source: 'workspace',
        title:  rel,
        path:   rel,
      });
      indexed++;
    } catch { /* skip unreadable files */ }
  }

  return indexed;
}

/**
 * Return basic stats about the memory index.
 */
export async function getIndexStats(): Promise<{ items: number; indexDir: string }> {
  const idx   = await getIndex();
  const items = (await idx.listItems()).length;
  return { items, indexDir: indexDir() };
}

/**
 * Delete and recreate the index (full wipe).
 */
export async function clearIndex(): Promise<void> {
  _indexPromise = null;
  const dir = indexDir();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
