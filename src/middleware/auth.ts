import { Request, Response, NextFunction } from 'express';
import { isValidApiKey, isAuthRequired, getKeyMetadata } from './keyStore';

export interface AuthenticatedRequest extends Request {
  apiKeyMeta?: {
    apiKey: string;
    name?: string;
    role?: string;
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If no API keys are configured (neither CSV nor env var), permit open access
  if (!isAuthRequired()) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        message: 'Missing or improperly formatted Authorization header. Use Bearer <token>',
        type: 'invalid_request_error',
        code: 'missing_api_key',
      },
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!isValidApiKey(token)) {
    res.status(401).json({
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    });
    return;
  }

  (req as AuthenticatedRequest).apiKeyMeta = getKeyMetadata(token);
  next();
}
