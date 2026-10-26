import { Router, Request, Response } from 'express';
import { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk } from '../types/openai';
import { BaseProvider } from '../providers/base';
import { ClaudeProvider } from '../providers/claude';
import { AgyProvider } from '../providers/agy';
import { CodexProvider } from '../providers/codex';
import { PassThrough } from 'stream';

const router = Router();

const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '120000', 10);
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'claude';

function getProvider(model: string): BaseProvider {
  const m = model.toLowerCase();

  if (m === 'claude' || m.startsWith('claude-') || m.startsWith('anthropic')) {
    return new ClaudeProvider({ timeoutMs: TIMEOUT_MS });
  }

  if (m === 'agy' || m.startsWith('agy-') || m.startsWith('gemini-') || m === 'google') {
    return new AgyProvider({ timeoutMs: TIMEOUT_MS });
  }

  if (
    m === 'codex' ||
    m.startsWith('codex-') ||
    m.startsWith('gpt-') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4')
  ) {
    return new CodexProvider({ timeoutMs: TIMEOUT_MS });
  }

  // Fallback to default provider
  switch (DEFAULT_PROVIDER) {
    case 'agy': return new AgyProvider({ timeoutMs: TIMEOUT_MS });
    case 'codex': return new CodexProvider({ timeoutMs: TIMEOUT_MS });
    default: return new ClaudeProvider({ timeoutMs: TIMEOUT_MS });
  }
}

function generateId(): string {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}`;
}

router.post('/', async (req: Request, res: Response) => {
  const body = req.body as ChatCompletionRequest;

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({
      error: { message: 'messages is required and must be a non-empty array', type: 'invalid_request_error' }
    });
    return;
  }

  const model = body.model || DEFAULT_PROVIDER;
  const provider = getProvider(model);
  const id = generateId();
  const created = Math.floor(Date.now() / 1000);

  if (body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial role delta
    const roleDelta: ChatCompletionChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    };
    res.write(`data: ${JSON.stringify(roleDelta)}\n\n`);

    const passThrough = new PassThrough();
    let buffer = '';

    passThrough.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      buffer += text;

      // Emit each character or small chunk as SSE
      const contentChunk: ChatCompletionChunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      };
      res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
    });

    try {
      await provider.stream(body.messages, model, passThrough);

      const doneChunk: ChatCompletionChunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      };
      res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[chat] Stream error:', errorMsg);
      res.write(`data: ${JSON.stringify({ error: { message: errorMsg } })}\n\n`);
      res.end();
    }
  } else {
    try {
      const content = await provider.complete(body.messages, model);

      const response: ChatCompletionResponse = {
        id,
        object: 'chat.completion',
        created,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      res.json(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[chat] Error:', errorMsg);
      res.status(500).json({
        error: { message: errorMsg, type: 'provider_error' }
      });
    }
  }
});

export default router;
