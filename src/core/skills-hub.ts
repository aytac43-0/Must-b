/**
 * Must-b Skills Hub (v4.5)
 *
 * Records completed workflows as reusable "skills" — JSON files stored under
 * workspace/skills/.  Skills can be listed, run again (replays the same goal
 * through the live orchestrator), and deleted.
 *
 * Data shape  (workspace/skills/<id>.json):
 * {
 *   id, name, goal, answer,
 *   steps: [{ description, tool }],   ← minimal shape — no secrets / params
 *   tags, savedAt, runCount, lastRunAt?
 * }
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';

// Lazy-resolve WORKSPACE_ROOT so skills-hub can be imported before paths.ts
// init runs (e.g. in tests).
function skillsDir(): string {
  // Dynamic require avoids circular-import issues and keeps module loading fast.
  const { WORKSPACE_ROOT } = require('./paths.js') as { WORKSPACE_ROOT: string };
  const dir = path.join(WORKSPACE_ROOT, 'skills');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface SkillStep {
  description: string;
  tool?:       string;
}

export interface SavedSkill {
  id:         string;
  name:       string;
  goal:       string;
  answer:     string;
  steps:      SkillStep[];
  tags:       string[];
  savedAt:    string;
  runCount:   number;
  lastRunAt?: string;
}

export type SaveSkillInput = Pick<SavedSkill, 'goal' | 'answer' | 'steps'> & {
  name?: string;
  tags?: string[];
};

// ── Path guard ──────────────────────────────────────────────────────────────

function resolveSkillPath(id: string): string {
  // Allow only alphanumeric, dashes, underscores — block traversal
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error(`Invalid skill ID: "${id}"`);
  return path.join(skillsDir(), `${id}.json`);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/** Save a completed workflow as a reusable skill. Returns the stored skill. */
export function saveSkill(input: SaveSkillInput): SavedSkill {
  const id   = crypto.randomUUID();
  const name = input.name?.trim() ||
    input.goal.trim().slice(0, 60) + (input.goal.length > 60 ? '…' : '');

  const skill: SavedSkill = {
    id,
    name,
    goal:    input.goal,
    answer:  input.answer,
    steps:   input.steps.map(s => ({ description: s.description, tool: s.tool })),
    tags:    input.tags ?? [],
    savedAt: new Date().toISOString(),
    runCount: 0,
  };

  fs.writeFileSync(resolveSkillPath(id), JSON.stringify(skill, null, 2), 'utf8');
  return skill;
}

/** Return all saved skills sorted newest-first. */
export function listSkills(): SavedSkill[] {
  const dir = skillsDir();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as SavedSkill; }
      catch { return null; }
    })
    .filter((s): s is SavedSkill => s !== null)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Load a single skill by ID. Returns null if not found. */
export function getSkill(id: string): SavedSkill | null {
  try { return JSON.parse(fs.readFileSync(resolveSkillPath(id), 'utf8')) as SavedSkill; }
  catch { return null; }
}

/** Delete a skill. Returns true if deleted, false if not found. */
export function deleteSkill(id: string): boolean {
  try { fs.rmSync(resolveSkillPath(id)); return true; }
  catch { return false; }
}

/** Increment run counter and update lastRunAt after a skill is executed. */
export function bumpRunCount(id: string): void {
  const skill = getSkill(id);
  if (!skill) return;
  skill.runCount++;
  skill.lastRunAt = new Date().toISOString();
  fs.writeFileSync(resolveSkillPath(id), JSON.stringify(skill, null, 2), 'utf8');
}
