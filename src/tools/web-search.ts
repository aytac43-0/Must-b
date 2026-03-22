/**
 * Must-b Web Search Tool (v1.0)
 *
 * Searches the web via DuckDuckGo (no API key required).
 * Falls back to DuckDuckGo Instant Answer API for structured results.
 * Returns ranked list of { title, url, snippet }.
 */

import https from 'https';
import http  from 'http';
import { URL } from 'url';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchParams {
  query:       string;
  maxResults?: number;   // default 8
  region?:     string;   // e.g. 'us-en', default 'wt-wt' (worldwide)
  safeSearch?: 'strict' | 'moderate' | 'off';
}

export interface SearchResult {
  title:   string;
  url:     string;
  snippet: string;
}

// ── HTTP helper ────────────────────────────────────────────────────────────

function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const client  = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  {
        'User-Agent': 'Mozilla/5.0 (compatible; Must-b/1.0; +https://must-b.com)',
        'Accept':     'text/html,application/json',
        ...headers,
      },
      timeout: 10_000,
    };
    const req = client.request(options, (res) => {
      // follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchText(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

// ── Parsers ────────────────────────────────────────────────────────────────

/** Parse DuckDuckGo HTML results page */
function parseDDGHtml(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
  // result blocks look like: <a class="result__a" href="...">TITLE</a>
  const linkRe    = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html)) !== null) {
    snippets.push(sm[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
  }
  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) !== null && results.length < max) {
    const url   = lm[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=([^&]+).*/,
      (_: string, u: string) => decodeURIComponent(u));
    const title = lm[2].replace(/<[^>]+>/g, '').trim();
    if (!url.startsWith('http')) { i++; continue; }
    results.push({ url, title, snippet: snippets[i] ?? '' });
    i++;
  }
  return results;
}

/** Parse DuckDuckGo Instant Answer API (JSON) for extra structured results */
function parseDDGJson(body: string, max: number): SearchResult[] {
  try {
    const data = JSON.parse(body);
    const out: SearchResult[] = [];
    if (data.AbstractURL && data.Heading) {
      out.push({ title: data.Heading, url: data.AbstractURL, snippet: data.AbstractText ?? '' });
    }
    for (const r of (data.RelatedTopics ?? [])) {
      if (out.length >= max) break;
      if (r.FirstURL && r.Text) out.push({ title: r.Text.slice(0, 80), url: r.FirstURL, snippet: r.Text });
    }
    return out;
  } catch { return []; }
}

// ── WebSearch ──────────────────────────────────────────────────────────────

export class WebSearch {
  /**
   * Search DuckDuckGo and return ranked results.
   * Tries HTML search first for real SERP results;
   * falls back to Instant Answer API if HTML parse returns nothing.
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    const max    = params.maxResults ?? 8;
    const q      = encodeURIComponent(params.query);
    const region = params.region ?? 'wt-wt';

    // 1) HTML search — real SERP results
    try {
      const url  = `https://html.duckduckgo.com/html/?q=${q}&kl=${region}`;
      const html = await fetchText(url);
      const hits = parseDDGHtml(html, max);
      if (hits.length > 0) return hits;
    } catch { /* fall through */ }

    // 2) Instant Answer API fallback
    try {
      const url  = `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`;
      const body = await fetchText(url);
      const hits = parseDDGJson(body, max);
      if (hits.length > 0) return hits;
    } catch { /* fall through */ }

    return [];
  }

  /**
   * Search and return a clean plain-text summary for LLM consumption.
   */
  async searchText(params: SearchParams): Promise<string> {
    const results = await this.search(params);
    if (results.length === 0) return `No results found for: ${params.query}`;
    return results
      .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
      .join('\n\n');
  }
}
