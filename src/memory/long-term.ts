import fs from 'fs/promises';
import path from 'path';

export interface UserProfile {
  name: string;
  mode: 'local' | 'world';
  uid?: string;
  createdAt?: string;
  lastSeenAt?: string;
  preferences?: Record<string, unknown>;
}

export interface ConversationEntry {
  timestamp: string;
  goal: string;
  outcome: 'completed' | 'failed' | 'partial';
  summary?: string;
}

export interface LongTermData {
  profile: UserProfile | null;
  conversations: ConversationEntry[];
}

const EMPTY: LongTermData = { profile: null, conversations: [] };

export class LongTermMemory {
  private root: string;
  private data: LongTermData = EMPTY;

  constructor(root: string) {
    this.root = root;
  }

  private get jsonPath() {
    return path.join(this.root, 'memory', 'user.json');
  }

  private get mdPath() {
    return path.join(this.root, 'memory', 'must-b.md');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.jsonPath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = { profile: null, conversations: [] };
    }
  }

  setProfile(profile: Omit<UserProfile, 'createdAt' | 'lastSeenAt'>) {
    const now = new Date().toISOString();
    this.data.profile = {
      ...profile,
      createdAt: this.data.profile?.createdAt ?? now,
      lastSeenAt: now,
    };
  }

  touchLastSeen() {
    if (this.data.profile) {
      this.data.profile.lastSeenAt = new Date().toISOString();
    }
  }

  async recordConversation(entry: Omit<ConversationEntry, 'timestamp'>) {
    await this.load();
    this.data.conversations.push({ ...entry, timestamp: new Date().toISOString() });
    // Keep last 200 conversations
    if (this.data.conversations.length > 200) {
      this.data.conversations = this.data.conversations.slice(-200);
    }
    await this.save();
  }

  getProfile(): UserProfile | null {
    return this.data.profile;
  }

  getRecentConversations(n = 10): ConversationEntry[] {
    return this.data.conversations.slice(-n);
  }

  /** Returns a markdown context string injected into the agent's system prompt. */
  getContextSummary(): string {
    const p = this.data.profile;
    if (!p) return '';

    const recent = this.getRecentConversations(5);
    const lines: string[] = [
      '## User Memory',
      `- Name: ${p.name}`,
      `- Mode: ${p.mode}`,
      p.uid ? `- World UID: ${p.uid}` : '',
      `- Last seen: ${p.lastSeenAt ?? 'now'}`,
    ].filter(Boolean);

    if (recent.length > 0) {
      lines.push('', '## Recent Goals');
      for (const c of recent) {
        lines.push(`- [${c.outcome}] ${c.goal}${c.summary ? ' — ' + c.summary : ''}`);
      }
    }

    return lines.join('\n');
  }

  async save(): Promise<void> {
    const dir = path.join(this.root, 'memory');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.jsonPath, JSON.stringify(this.data, null, 2), 'utf-8');
    await this.saveMd();
  }

  private async saveMd(): Promise<void> {
    const p = this.data.profile;
    const now = new Date().toISOString();
    const recent = this.getRecentConversations(20);

    const lines = [
      '# Must-b Memory',
      `> Auto-generated — last updated ${now}`,
      '',
      '## Profile',
      p ? [
        `- **Name:** ${p.name}`,
        `- **Mode:** ${p.mode}`,
        p.uid ? `- **World UID:** ${p.uid}` : '',
        `- **Created:** ${p.createdAt ?? now}`,
        `- **Last seen:** ${p.lastSeenAt ?? now}`,
      ].filter(Boolean).join('\n') : '_No profile yet. Run `must-b onboard` to set up._',
      '',
      '## Conversation History (last 20)',
    ];

    if (recent.length === 0) {
      lines.push('_No conversations recorded yet._');
    } else {
      for (const c of recent) {
        const icon = c.outcome === 'completed' ? '✓' : c.outcome === 'failed' ? '✗' : '~';
        lines.push(`- ${icon} \`${c.timestamp.slice(0, 10)}\` **${c.goal}**${c.summary ? ': ' + c.summary : ''}`);
      }
    }

    await fs.writeFile(this.mdPath, lines.join('\n') + '\n', 'utf-8');
  }
}
