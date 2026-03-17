/**
 * Must-b Agent Hierarchy
 *
 * Maps HardwareTier → AgentRole and defines which task categories
 * each role is permitted to accept, plan, or delegate.
 *
 * Role ladder:
 *   Worker  — executes tasks handed down from higher tiers
 *   Planner — breaks goals into sub-tasks, can delegate to Workers
 *   Master  — full autonomy: coordinates networks, publishes skills,
 *              routes P2P tasks across the Must-b Worlds grid
 */

import { getHardwareScore, loadOrCreateIdentity, type HardwareTier } from './identity.js';
import { MODELS_LIST } from './models-catalog.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type AgentRole = 'Worker' | 'Planner' | 'Master';

export interface RoleCapabilities {
  role:            AgentRole;
  tier:            HardwareTier;
  score:           number;
  /** Can this agent accept tasks from other agents? */
  canReceiveTasks: boolean;
  /** Can this agent plan and delegate sub-tasks? */
  canDelegate:     boolean;
  /** Can this agent publish skills to the global market? */
  canPublishSkills: boolean;
  /** Can this agent run the idling self-improvement loop? */
  canIdleInfer:    boolean;
  /** Maximum concurrent tasks this agent should handle */
  maxConcurrent:   number;
  /** Human-readable description of this tier's responsibilities */
  description:     string;
  /** Task categories this agent can handle autonomously */
  allowedTasks:    string[];
}

// ── Role mapping ─────────────────────────────────────────────────────────

const TIER_ROLES: Record<HardwareTier, AgentRole> = {
  'Macro':     'Worker',
  'Mini':      'Worker',
  'Normal':    'Worker',
  'Pro':       'Planner',
  'Ultra':     'Master',
  'Ultra Max': 'Master',
};

const ROLE_META: Record<AgentRole, Omit<RoleCapabilities, 'role' | 'tier' | 'score'>> = {
  Worker: {
    canReceiveTasks:  true,
    canDelegate:      false,
    canPublishSkills: false,
    canIdleInfer:     false,
    maxConcurrent:    2,
    description: 'Executes assigned tasks. Ideal for lightweight background processing.',
    allowedTasks: [
      'filesystem',
      'memory_search',
      'terminal_safe',
      'web_search',
    ],
  },
  Planner: {
    canReceiveTasks:  true,
    canDelegate:      true,
    canPublishSkills: true,  // Pro+ can publish
    canIdleInfer:     true,
    maxConcurrent:    4,
    description: 'Plans and coordinates multi-step tasks. Can delegate to Workers.',
    allowedTasks: [
      'filesystem',
      'memory_search',
      'memory_write',
      'terminal',
      'web_search',
      'browser',
      'goal_planning',
      'skill_install',
    ],
  },
  Master: {
    canReceiveTasks:  true,
    canDelegate:      true,
    canPublishSkills: true,
    canIdleInfer:     true,
    maxConcurrent:    8,
    description: 'Full autonomy. Coordinates networks, routes P2P tasks, manages the Worlds grid.',
    allowedTasks: [
      'filesystem',
      'memory_search',
      'memory_write',
      'terminal',
      'web_search',
      'browser',
      'goal_planning',
      'skill_install',
      'skill_publish',
      'p2p_route',
      'world_broadcast',
      'agent_spawn',
    ],
  },
};

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Minimum model minScore to qualify for Planner-level operations.
 * Models below this threshold are considered Worker-tier regardless of hardware.
 * (phi3:mini minScore=4, phi3:medium minScore=8 → threshold is 8)
 */
const WORKER_MODEL_THRESHOLD = 8;

/**
 * Compute this agent's role capabilities from its current hardware score.
 *
 * @param activeModelId  Optional: the currently selected model's id or modelId.
 *                       If the model's minScore is below WORKER_MODEL_THRESHOLD
 *                       the returned role is capped to 'Worker', regardless of
 *                       hardware tier — a weak model limits what the agent can do.
 */
export function getAgentRole(activeModelId?: string): RoleCapabilities {
  const { score, tier } = getHardwareScore();
  let role = TIER_ROLES[tier];

  // Hierarchy lock: if the active model is below Worker threshold, cap to Worker
  if (activeModelId) {
    const activeModel = MODELS_LIST.find(
      m => m.id === activeModelId || m.modelId === activeModelId
    );
    if (activeModel && activeModel.category === 'local' && activeModel.minScore < WORKER_MODEL_THRESHOLD) {
      role = 'Worker';
    }
  }

  const meta = ROLE_META[role];
  return { role, tier, score, ...meta };
}

/**
 * Given a recipient's hardware score and tier, decide whether this agent
 * should route a task to that recipient.
 *
 * Rules:
 *   - Recipient must be able to receive tasks (canReceiveTasks)
 *   - Recipient score must be ≥ taskMinScore
 *   - Sender must be Planner or Master (Workers cannot delegate)
 */
export function canRouteTo(
  senderCaps: RoleCapabilities,
  recipientScore: number,
  recipientTier: HardwareTier,
  taskMinScore: number
): boolean {
  if (!senderCaps.canDelegate) return false;
  const recipientRole  = TIER_ROLES[recipientTier];
  const recipientMeta  = ROLE_META[recipientRole];
  if (!recipientMeta.canReceiveTasks) return false;
  return recipientScore >= taskMinScore;
}

/**
 * Serialize this node's identity + role for P2P handshake payloads.
 */
export function getNodeCard(): {
  uid: string;
  publicKey: string;
  role: AgentRole;
  tier: HardwareTier;
  score: number;
} {
  const identity = loadOrCreateIdentity();
  const { role, tier, score } = getAgentRole();
  return { uid: identity.uid, publicKey: identity.publicKey, role, tier, score };
}
