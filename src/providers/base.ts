import { ChatMessage } from '../types/openai';
import { Writable } from 'stream';

export interface ProviderOptions {
  timeoutMs: number;
}

export abstract class BaseProvider {
  protected timeoutMs: number;

  constructor(options: ProviderOptions) {
    this.timeoutMs = options.timeoutMs;
  }

  abstract complete(messages: ChatMessage[], model: string): Promise<string>;
  abstract stream(messages: ChatMessage[], model: string, output: Writable): Promise<void>;

  protected formatMessages(messages: ChatMessage[]): string {
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        parts.push(`System: ${msg.content}`);
      } else if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`);
      }
    }
    parts.push('Assistant:');
    return parts.join('\n\n');
  }
}
