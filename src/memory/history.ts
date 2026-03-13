import fs from 'fs/promises';
import path from 'path';
import winston from 'winston';

export interface SessionEntry {
  timestamp: string;
  goal: string;
  status: 'started' | 'planning' | 'executing' | 'completed' | 'failed';
  steps?: any[];
  error?: string;
}

export class SessionHistory {
  private logger: winston.Logger;
  private filePath: string;

  constructor(logger: winston.Logger, dir: string = 'memory') {
    this.logger = logger;
    this.filePath = path.resolve(dir, 'sessions.json');
    fs.mkdir(dir, { recursive: true }).catch(() => {});
  }

  async load(): Promise<SessionEntry[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async append(entry: SessionEntry): Promise<void> {
    const history = await this.load();
    history.push(entry);
    await fs.writeFile(this.filePath, JSON.stringify(history, null, 2), 'utf-8');
  }

  async lastN(n: number): Promise<SessionEntry[]> {
    const history = await this.load();
    return history.slice(-n);
  }
}
