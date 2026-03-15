/**
 * SemanticMemory — Node 24 built-in node:sqlite + FTS5 tabanlı bellek motoru.
 * Harici native bağımlılık gerektirmez (Node 22.5+ built-in SQLite).
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs/promises';
import { watch, type FSWatcher } from 'chokidar';

export interface MemoryEntry {
  id: number;
  date: string;
  content: string;
  source: string;
  score: number;
}

/** Exponential temporal decay — half-life = 30 days */
function applyDecay(score: number, dateStr: string): number {
  const HALF_LIFE = 30;
  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return score * Math.exp((-Math.LN2 / HALF_LIFE) * ageDays);
}

/** Escape and build FTS5 MATCH query from free-text input */
function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replaceAll('"', '')}"`).join(' OR ');
}

export class SemanticMemory {
  private db: DatabaseSync;
  private memoryDir: string;
  private watcher: FSWatcher | null = null;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    const dbPath = path.join(memoryDir, 'semantic.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL`);
    this.db.exec(`PRAGMA synchronous=NORMAL`);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        date       TEXT    NOT NULL,
        content    TEXT    NOT NULL,
        source     TEXT    NOT NULL DEFAULT 'conversation',
        file_path  TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        source,
        date,
        tokenize = 'unicode61'
      );
    `);
  }

  /** Tek bir bellek kaydı ekle */
  insert(content: string, source = 'conversation', date?: string): number {
    const d = date ?? new Date().toISOString().slice(0, 10);
    const row = this.db
      .prepare('INSERT INTO memories (date, content, source) VALUES (?, ?, ?)')
      .run(d, content, source) as { lastInsertRowid: number | bigint };
    const id = Number(row.lastInsertRowid);
    this.db
      .prepare('INSERT INTO memories_fts (rowid, content, source, date) VALUES (?, ?, ?, ?)')
      .run(id, content, source, d);
    return id;
  }

  /**
   * FTS5 + temporal decay ile arama.
   * En alakalı + en yeni kayıtlar önce gelir.
   */
  search(query: string, limit = 10): MemoryEntry[] {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    const rows = this.db
      .prepare(
        `SELECT m.id, m.date, m.content, m.source, rank AS base_score
         FROM memories_fts f
         JOIN memories m ON m.id = f.rowid
         WHERE memories_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(ftsQuery, limit * 3) as Array<{
      id: number;
      date: string;
      content: string;
      source: string;
      base_score: number;
    }>;

    return rows
      .map((r) => ({
        id: r.id,
        date: r.date,
        content: r.content,
        source: r.source,
        score: applyDecay(Math.abs(r.base_score), r.date),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Tarihli bir YYYY-MM-DD.md dosyasını paragraf bazında indeksle */
  async indexMarkdownFile(filePath: string): Promise<void> {
    const basename = path.basename(filePath);
    const dateMatch = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(basename);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return;
    }
    if (!content.trim()) return;

    // Bu dosyadan gelen mevcut kayıtları sil, sonra yeniden ekle
    const existing = this.db
      .prepare('SELECT id FROM memories WHERE file_path = ?')
      .all(filePath) as Array<{ id: number }>;

    const deleteMemory = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const deleteFts    = this.db.prepare('DELETE FROM memories_fts WHERE rowid = ?');
    for (const row of existing) {
      deleteMemory.run(row.id);
      deleteFts.run(row.id);
    }

    // >20 karakter olan paragrafları al
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    const insertMemory = this.db.prepare(
      'INSERT INTO memories (date, content, source, file_path) VALUES (?, ?, ?, ?)',
    );
    const insertFts = this.db.prepare(
      'INSERT INTO memories_fts (rowid, content, source, date) VALUES (?, ?, ?, ?)',
    );

    for (const para of paragraphs) {
      const row = insertMemory.run(date, para, 'memory-file', filePath) as {
        lastInsertRowid: number | bigint;
      };
      const id = Number(row.lastInsertRowid);
      insertFts.run(id, para, 'memory-file', date);
    }
  }

  /** memory/ klasörünü izle — YYYY-MM-DD.md değişince otomatik yeniden indeksle */
  async startWatcher(): Promise<void> {
    try {
      const files = await fs.readdir(this.memoryDir);
      for (const file of files) {
        if (/^\d{4}-\d{2}-\d{2}\.md$/.test(file)) {
          await this.indexMarkdownFile(path.join(this.memoryDir, file));
        }
      }
    } catch {
      // memory/ henüz mevcut değilse sessizce geç
    }

    this.watcher = watch(path.join(this.memoryDir, '*.md'), {
      ignoreInitial: false,
      persistent: false,
    });

    this.watcher.on('add', (fp) => void this.indexMarkdownFile(fp));
    this.watcher.on('change', (fp) => void this.indexMarkdownFile(fp));
  }

  /**
   * Bugünün günlük bellek dosyasına giriş ekle (Temporal Memory).
   * Format: memory/YYYY-MM-DD.md
   */
  async writeDailyEntry(content: string): Promise<string> {
    await fs.mkdir(this.memoryDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(this.memoryDir, `${date}.md`);

    let existing = '';
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      existing = `# Memory — ${date}\n`;
    }

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const entry = `\n## ${ts}\n\n${content}\n`;
    await fs.writeFile(filePath, existing + entry, 'utf-8');
    await this.indexMarkdownFile(filePath);
    return filePath;
  }

  /** Toplam kayıt sayısı */
  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as c FROM memories')
      .get() as { c: number };
    return row.c;
  }

  close(): void {
    this.watcher?.close();
    this.db.close();
  }
}
