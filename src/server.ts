import express from 'express';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware } from './middleware/logger';
import { loadApiKeys } from './middleware/keyStore';
import chatRouter from './routes/chat';
import modelsRouter from './routes/models';

export function createServer(): express.Application {
  loadApiKeys();
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(loggerMiddleware);
  // Public routes (Health check & info)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'cli-openai-proxy',
      description: 'OpenAI-compatible API proxy for CLI tools',
      version: '1.0.0',
      endpoints: [
        'GET  /v1/models',
        'POST /v1/chat/completions',
        'GET  /health',
      ],
    });
  });

  // Protected OpenAI-compatible routes
  app.use('/v1/chat/completions', authMiddleware, chatRouter);
  app.use('/v1/models', authMiddleware, modelsRouter);

  return app;
}
