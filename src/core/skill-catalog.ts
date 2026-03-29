/**
 * Skill Catalog (v1.0) — Skill_Master
 *
 * Scans src/core/skills/ for SKILL.md files and returns a catalog of
 * all native skills — no external service dependencies.
 *
 * Each SKILL.md has YAML frontmatter:
 *   name, description, homepage?, metadata: { "must-b": { emoji, requires } }
 *
 * Public API:
 *   loadSkillCatalog()  → CatalogSkill[]   (cached after first load)
 *   refreshCatalog()    → CatalogSkill[]   (force re-scan)
 */

import fs   from 'fs';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CatalogSkillRequires {
  bins?:   string[];
  config?: string[];
}

export interface CatalogSkill {
  /** Directory slug (folder name under src/core/skills/) */
  id:          string;
  name:        string;
  description: string;
  homepage?:   string;
  emoji?:      string;
  requires:    CatalogSkillRequires;
  /** Whether the skill has helper scripts (scripts/ dir) */
  hasScripts:  boolean;
}

// ── Internal ──────────────────────────────────────────────────────────────

let _cache: CatalogSkill[] | null = null;

function skillsRoot(): string {
  const base = process.env.MUSTB_ROOT ?? process.cwd();
  return path.join(base, 'src', 'core', 'skills');
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Handles both single-line and multi-line metadata blocks.
 */
function parseFrontmatter(content: string): Partial<CatalogSkill> & { requiresRaw?: CatalogSkillRequires } {
  // Extract everything between first pair of --- markers
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return {};
  const fm = fmMatch[1];

  // name (unquoted)
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';

  // description — may be "..." quoted with embedded commas/colons
  let description = '';
  const descQuoted = fm.match(/^description:\s*"((?:[^"\\]|\\.)*)"\s*$/m);
  if (descQuoted) {
    description = descQuoted[1].replace(/\\"/g, '"');
  } else {
    const descPlain = fm.match(/^description:\s*(.+)$/m);
    if (descPlain) description = descPlain[1].trim().replace(/^["']|["']$/g, '');
  }

  // homepage
  const homeMatch = fm.match(/^homepage:\s*(.+)$/m);
  const homepage  = homeMatch?.[1]?.trim();

  // emoji — inside metadata JSON (single or multi-line)
  const emojiMatch = fm.match(/"emoji":\s*"([^"]+)"/);
  const emoji      = emojiMatch?.[1];

  // requires.bins — ["bin1", "bin2"]
  const binsBlock = fm.match(/"bins":\s*\[([^\]]*)\]/);
  const bins = binsBlock
    ? (binsBlock[1].match(/"([^"]+)"/g) ?? []).map(s => s.replace(/"/g, ''))
    : undefined;

  // requires.config — ["key1"]
  const cfgBlock = fm.match(/"config":\s*\[([^\]]*)\]/);
  const config = cfgBlock
    ? (cfgBlock[1].match(/"([^"]+)"/g) ?? []).map(s => s.replace(/"/g, ''))
    : undefined;

  return {
    name,
    description,
    homepage,
    emoji,
    requiresRaw: { bins, config },
  };
}

function loadOne(skillDir: string, id: string): CatalogSkill | null {
  const mdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(mdPath)) return null;

  let content = '';
  try { content = fs.readFileSync(mdPath, 'utf8'); }
  catch { return null; }

  const { name, description, homepage, emoji, requiresRaw } = parseFrontmatter(content);

  const hasScripts = fs.existsSync(path.join(skillDir, 'scripts'));

  return {
    id,
    name:        name        || id,
    description: description || '',
    homepage,
    emoji,
    requires:    requiresRaw ?? {},
    hasScripts,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Load and cache all catalog skills from src/core/skills/. */
export function loadSkillCatalog(): CatalogSkill[] {
  if (_cache) return _cache;
  return refreshCatalog();
}

/** Force re-scan of src/core/skills/ and update cache. */
export function refreshCatalog(): CatalogSkill[] {
  const root = skillsRoot();
  if (!fs.existsSync(root)) {
    _cache = [];
    return _cache;
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const skills: CatalogSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(root, entry.name);
    const skill = loadOne(skillDir, entry.name);
    if (skill) skills.push(skill);
  }

  // Sort alphabetically by id
  skills.sort((a, b) => a.id.localeCompare(b.id));
  _cache = skills;
  return skills;
}
