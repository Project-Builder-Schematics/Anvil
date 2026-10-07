import { describe, expect, it } from 'bun:test';
import { isTransientConnectionError, retry } from './retry';

const transient = new Error('connect ECONNREFUSED 127.0.0.1:5432');

function flaky(failures: number, error: Error = transient) {
  let calls = 0;
  const fn = () => {
    calls++;
    if (calls <= failures) return Promise.reject(error);
    return Promise.resolve('ok');
  };
  return { fn, calls: () => calls };
}

describe('retry', () => {
  it('retries transient errors with a doubling, capped backoff', async () => {
    const delays: number[] = [];
    const { fn, calls } = flaky(3);
    const result = await retry(fn, {
      attempts: 5,
      baseMs: 100,
      maxMs: 300,
      shouldRetry: isTransientConnectionError,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    expect(result).toBe('ok');
    expect(calls()).toBe(4);
    expect(delays).toEqual([100, 200, 300]);
  });

  it('gives up after the bounded number of attempts and throws the last error', async () => {
    const { fn, calls } = flaky(10);
    const error = await retry(fn, {
      attempts: 3,
      baseMs: 1,
      maxMs: 1,
      shouldRetry: isTransientConnectionError,
      sleep: () => Promise.resolve(),
    }).catch((e: unknown) => e);
    expect(error).toBe(transient);
    expect(calls()).toBe(3);
  });

  it('does not retry an error that is not transient', async () => {
    const { fn, calls } = flaky(
      10,
      new Error('password authentication failed'),
    );
    const error = await retry(fn, {
      attempts: 5,
      baseMs: 1,
      maxMs: 1,
      shouldRetry: isTransientConnectionError,
      sleep: () => Promise.resolve(),
    }).catch((e: unknown) => e);
    expect((error as Error).message).toBe('password authentication failed');
    expect(calls()).toBe(1);
  });
});

describe('isTransientConnectionError', () => {
  it.each([
    new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    new Error('the database system is starting up'),
    Object.assign(new Error('closed'), {
      code: 'ERR_POSTGRES_CONNECTION_CLOSED',
    }),
  ])('accepts %p', (error) => {
    expect(isTransientConnectionError(error)).toBe(true);
  });

  it.each([new Error('password authentication failed'), 'boom', undefined])(
    'rejects %p',
    (error) => {
      expect(isTransientConnectionError(error)).toBe(false);
    },
  );
});
