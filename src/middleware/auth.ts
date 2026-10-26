import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Missing Authorization header', type: 'invalid_request_error', code: 'missing_api_key' } });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== apiKey) {
    res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } });
    return;
  }

  next();
}
