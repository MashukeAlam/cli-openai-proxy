import { Router, Request, Response } from 'express';
import { ModelsResponse, ModelObject } from '../types/openai';

const router = Router();

const MODELS: ModelObject[] = [
  { id: 'claude', object: 'model', created: 1700000000, owned_by: 'anthropic-cli' },
  { id: 'claude-3-5-sonnet', object: 'model', created: 1700000000, owned_by: 'anthropic-cli' },
  { id: 'claude-3-opus', object: 'model', created: 1700000000, owned_by: 'anthropic-cli' },
  { id: 'claude-3-haiku', object: 'model', created: 1700000000, owned_by: 'anthropic-cli' },
  { id: 'agy', object: 'model', created: 1700000000, owned_by: 'google-cli' },
  { id: 'gemini-2.0-flash', object: 'model', created: 1700000000, owned_by: 'google-cli' },
  { id: 'gemini-1.5-pro', object: 'model', created: 1700000000, owned_by: 'google-cli' },
  { id: 'codex', object: 'model', created: 1700000000, owned_by: 'openai-cli' },
  { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'openai-cli' },
  { id: 'gpt-4-turbo', object: 'model', created: 1700000000, owned_by: 'openai-cli' },
  { id: 'o3', object: 'model', created: 1700000000, owned_by: 'openai-cli' },
  { id: 'o4-mini', object: 'model', created: 1700000000, owned_by: 'openai-cli' },
];

router.get('/', (_req: Request, res: Response) => {
  const response: ModelsResponse = {
    object: 'list',
    data: MODELS,
  };
  res.json(response);
});

export default router;
