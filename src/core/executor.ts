import winston from 'winston';
import { FilesystemTools } from '../tools/filesystem.js';
import { TerminalTools } from '../tools/terminal.js';

export interface PlanStep {
  id: string;
  description: string;
  tool: string;
  parameters: Record<string, any>;
}

export class Executor {
  private logger: winston.Logger;
  private fsTools: FilesystemTools;
  private terminalTools: TerminalTools;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.fsTools = new FilesystemTools();
    this.terminalTools = new TerminalTools();
  }

  async executeStep(step: PlanStep): Promise<any> {
    this.logger.info(`Executor: [${step.id}] ${step.description}`);
    
    try {
      let result: any;
      switch (step.tool) {
        case 'filesystem_read':
          result = await this.fsTools.readFile(step.parameters as any);
          break;
        case 'filesystem_write':
          result = await this.fsTools.writeFile(step.parameters as any);
          break;
        case 'filesystem_list':
          result = await this.fsTools.listFiles(step.parameters as any);
          break;
        case 'terminal':
          result = await this.terminalTools.execute(step.parameters as any);
          break;
        case 'log':
          this.logger.info(`> ${step.parameters.message}`);
          result = { success: true };
          break;
        default:
          throw new Error(`Unknown tool: ${step.tool}`);
      }

      this.logger.info(`Executor: Step completed.`);
      return result;

    } catch (error: any) {
      this.logger.error(`Executor: Error in step ${step.id} - ${error.message}`);
      throw error;
    }
  }
}
