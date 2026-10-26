import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = process.env.LOG_LEVEL || 'info';
    if (level !== 'none') {
      console.log(`[${new Date().toISOString()}] ${method} ${url} ${res.statusCode} ${duration}ms`);
    }
  });

  next();
}
