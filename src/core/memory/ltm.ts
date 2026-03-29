/**
 * LTMController — Long-Term Memory orchestrator
 *
 * Manages two memory categories:
 *   episodic  — conversation history (auto-indexed after every successful chat)
 *   semantic  — user preferences, code standards, project architecture knowledge
 *
 * Usage:
 *   const ltm = new LTMController(root);
 *   await ltm.init();
 *   const ctx = ltm.buildSystemContext(query);  // inject into LLM system prompt
 *   ltm.indexEpisodic(goal, outcome, summary);   // call after chat completion
 *   ltm.indexSemantic(content, tags);            // for explicit knowledge storage
 */
import path from 'path';
import fs   from 'fs/promises';
import { VectorStore, type MemoryCategory, type VectorEntry } from './vector-store.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LTMSearchResult {
  category: MemoryCategory;
  content:  string;
  tags:     string[];
  score:    number;
}

// ── LTMController ─────────────────────────────────────────────────────────────

export class LTMController {
  private store: VectorStore | null = null;
  private memDir: string;
  private initialized = false;

  constructor(root: string) {
    this.memDir = path.join(root, 'memory');
  }

  /** Initialize storage (creates memory dir if needed). Call once at startup. */
  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.memDir, { recursive: true });
    this.store = new VectorStore(this.memDir);
    this.initialized = true;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Auto-index a completed conversation into episodic memory.
   * Called automatically by Orchestrator after successful chat.
   */
  indexEpisodic(goal: string, outcome: 'completed' | 'failed' | 'partial', summary?: string): void {
    if (!this.store) return;
    const parts = [
      `Goal: ${goal}`,
      `Outcome: ${outcome}`,
      summary ? `Summary: ${summary}` : '',
    ].filter(Boolean);
    this.store.insert(parts.join('\n'), 'episodic', [outcome]);
  }

  /**
   * Store semantic knowledge (preferences, standards, architecture notes).
   * Can be called explicitly via API or memory_write tool.
   */
  indexSemantic(content: string, tags: string[] = []): void {
    if (!this.store) return;
    this.store.insert(content, 'semantic', tags);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Retrieve top-k relevant memories for a query.
   * Searches both categories by default; pass category to narrow.
   */
  retrieve(query: string, k = 6, category?: MemoryCategory): LTMSearchResult[] {
    if (!this.store) return [];
    return this.store.search(query, k, category).map(e => ({
      category: e.category,
      content:  e.content,
      tags:     e.tags,
      score:    e.score,
    }));
  }

  /**
   * Build the "System Memory" block injected into LLM system prompts.
   * Returns an empty string if no relevant memories are found.
   *
   * Format:
   *   ## System Memory
   *   ### Geçmiş Konuşmalar (Episodic)
   *   - [completed] Goal: ... / Summary: ...
   *   ### Tercihler & Standartlar (Semantic)
   *   - content
   */
  buildSystemContext(query: string): string {
    if (!this.store) return '';

    const episodic = this.store.search(query, 4, 'episodic');
    const semantic = this.store.search(query, 3, 'semantic');

    if (episodic.length === 0 && semantic.length === 0) return '';

    const lines: string[] = ['## System Memory (Long-Term)'];

    if (episodic.length > 0) {
      lines.push('### Geçmiş Konuşmalar');
      for (const e of episodic) {
        // Only show content, trim to 300 chars
        lines.push(`- ${e.content.replace(/\n/g, ' ').slice(0, 300)}`);
      }
    }

    if (semantic.length > 0) {
      lines.push('### Tercihler & Standartlar');
      for (const e of semantic) {
        const tagNote = e.tags.length ? ` [${e.tags.join(', ')}]` : '';
        lines.push(`- ${e.content.replace(/\n/g, ' ').slice(0, 400)}${tagNote}`);
      }
    }

    return lines.join('\n');
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  stats(): { episodic: number; semantic: number; total: number } {
    if (!this.store) return { episodic: 0, semantic: 0, total: 0 };
    const episodic = this.store.count('episodic');
    const semantic = this.store.count('semantic');
    return { episodic, semantic, total: episodic + semantic };
  }

  close(): void {
    this.store?.close();
    this.store = null;
    this.initialized = false;
  }
}
