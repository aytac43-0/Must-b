import winston from 'winston';
import { LLMProvider, CompletionMessage } from './provider.js';

export interface PlanStep {
  id: string;
  description: string;
  tool: "filesystem_read" | "filesystem_write" | "filesystem_list" | "terminal" | "log";
  parameters: Record<string, any>;
}

interface PlanResponse {
  steps: PlanStep[];
}

export class Planner {
  private logger: winston.Logger;
  private provider: LLMProvider;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.provider = new LLMProvider(logger);
  }

  async plan(goal: string): Promise<PlanStep[]> {
    this.logger.info(`Planner: Generating plan for goal: "${goal}"`);

    const systemPrompt = `You are the Planner for Must-b, an autonomous AI agent.
Your job is to break down a high-level user Goal into a linear sequence of executable steps.

Available Tools:
1. filesystem_read { path: string } - Read file content.
2. filesystem_write { path: string, content: string } - Write text to a file.
3. filesystem_list { path: string } - List files in a directory.
4. terminal { command: string } - Execute a shell command (git, npm, node, ls).
5. log { message: string } - Log a message or observation.

Rules:
- Return ONLY a valid JSON object.
- The JSON object must have a single key "steps" which is an array of steps.
- Each step must have: "id" (unique string), "description" (what this step does), "tool" (exact tool name), and "parameters" (object matching the tool signature).
- Be precise with file paths.
- Do not output markdown or explanations, just the JSON.

Example Output:
{
  "steps": [
    { "id": "1", "description": "List files", "tool": "filesystem_list", "parameters": { "path": "." } },
    { "id": "2", "description": "Say hello", "tool": "log", "parameters": { "message": "Done" } }
  ]
}`;

    const messages: CompletionMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Goal: ${goal}` }
    ];

    try {
      const planResponse = await this.provider.generateJson<PlanResponse>(messages);
      
      if (!planResponse.steps || !Array.isArray(planResponse.steps)) {
        throw new Error('Planner: Generated JSON is missing the "steps" array.');
      }

      this.logger.info(`Planner: Generated ${planResponse.steps.length} steps.`);
      return planResponse.steps;
    } catch (error: any) {
      this.logger.error(`Planner: Failed to generate plan - ${error.message}`);
      // Fallback to a safe logging plan if LLM fails
      return [
        {
          id: 'fallback-error',
          description: 'Report planning failure',
          tool: 'log',
          parameters: { message: `Planning failed for goal: ${goal}. Error: ${error.message}` }
        }
      ];
    }
  }
}
