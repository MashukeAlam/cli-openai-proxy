import { spawn } from 'child_process';
import { Writable } from 'stream';
import { ChatMessage } from '../types/openai';
import { BaseProvider, ProviderOptions } from './base';

export class CodexProvider extends BaseProvider {
  constructor(options: ProviderOptions) {
    super(options);
  }

  async complete(messages: ChatMessage[], _model: string): Promise<string> {
    const prompt = this.formatMessages(messages);
    return new Promise((resolve, reject) => {
      const proc = spawn('codex', [prompt], { shell: true });
      let output = '';
      let errOutput = '';

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('codex CLI timed out'));
      }, this.timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        errOutput += chunk.toString();
        process.stderr.write(chunk);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`codex CLI exited with code ${code}: ${errOutput}`));
        } else {
          resolve(output.trim());
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async stream(messages: ChatMessage[], _model: string, output: Writable): Promise<void> {
    const prompt = this.formatMessages(messages);
    return new Promise((resolve, reject) => {
      const proc = spawn('codex', [prompt], { shell: true });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('codex CLI timed out'));
      }, this.timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => {
        output.write(chunk.toString());
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        process.stderr.write(chunk);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`codex CLI exited with code ${code}`));
        } else {
          resolve();
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
