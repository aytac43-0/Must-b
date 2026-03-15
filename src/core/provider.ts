import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config({ override: true });

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMProvider {
  private model: string;
  private logger: winston.Logger;
  private baseUrl: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
    this.baseUrl = 'https://openrouter.ai/api/v1';

  }

  async generateJson<T>(messages: CompletionMessage[]): Promise<T> {
    const response = await this.chat(messages, { jsonMode: true });
    try {
      // Clean up markdown code blocks if present
      const cleanContent = response.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(cleanContent) as T;
    } catch (error: any) {
      this.logger.error(`Provider: Failed to parse JSON response: ${error.message}`);
      this.logger.debug(`Raw response: ${response}`);
      throw new Error('LLM failed to produce valid JSON');
    }
  }

  async chat(messages: CompletionMessage[], options: { jsonMode?: boolean } = {}): Promise<string> {
    // Re-read env so keys written by onboard wizard are picked up without restart
    dotenv.config({ override: true });
    const apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!apiKey) this.logger.warn('Provider: OPENROUTER_API_KEY is not set. LLM calls will fail.');
    this.logger.info(`Provider: Sending request to ${this.model}...`);

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://must-b.ai', // Required by OpenRouter
        'X-Title': 'Must-b Agent',
      };

      const body: any = {
        model: this.model,
        messages: messages,
        temperature: 0.1, // Low temp for deterministic planning
      };

      if (options.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Provider: Received empty response from LLM.');
      }

      return content;
    } catch (error: any) {
      this.logger.error(`Provider: LLM Request Failed - ${error.message}`);
      throw error;
    }
  }
}
