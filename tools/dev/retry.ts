export function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|CONNECTION_CLOSED|CONNECTION_TIMEOUT|starting up/i.test(
    `${String(code)} ${error.message}`,
  );
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    baseMs: number;
    maxMs: number;
    shouldRetry: (error: unknown) => boolean;
    sleep?: (ms: number) => Promise<unknown>;
  },
): Promise<T> {
  const { attempts, baseMs, maxMs, shouldRetry, sleep = Bun.sleep } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      await sleep(Math.min(baseMs * 2 ** (attempt - 1), maxMs));
    }
  }
}
