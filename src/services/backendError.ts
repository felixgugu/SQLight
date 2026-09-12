export class BackendError extends Error {
  constructor(message: string, readonly kind: string, readonly details: Record<string, unknown>) {
    super(message);
    this.name = 'BackendError';
  }
}

export function normalizeBackendError(error: unknown): Error {
  if (error instanceof Error) return error;
  let value = error;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return new Error(value as string); }
  }
  if (value && typeof value === 'object' && 'type' in value && 'details' in value) {
    const details = value.details;
    if (details && typeof details === 'object' && 'message' in details && typeof details.message === 'string') {
      return new BackendError(details.message, String(value.type), details as Record<string, unknown>);
    }
  }
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}
