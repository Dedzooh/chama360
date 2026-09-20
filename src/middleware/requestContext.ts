import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const requestStorage = new AsyncLocalStorage<{ requestId: string }>();

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const suppliedRequestId = req.get('X-Request-Id')?.trim();
  const requestId = suppliedRequestId?.startsWith('req_') ? suppliedRequestId : `req_${randomUUID()}`;
  res.setHeader('X-Request-Id', requestId);
  requestStorage.run({ requestId }, next);
};

export const currentRequestId = () => requestStorage.getStore()?.requestId;
