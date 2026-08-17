import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setRequestUserId(userId: string | undefined): void {
  const context = storage.getStore();
  if (context && userId) context.userId = userId;
}
