import { describe, expect, it } from 'bun:test';
import { exitCodeFor, parsePortOffset } from './cli';

describe('parsePortOffset', () => {
  it('is undefined when the flag is absent', () => {
    expect(parsePortOffset(['up', '--detach'])).toBeUndefined();
  });

  it('parses a non-negative integer, including 0', () => {
    expect(parsePortOffset(['--port-offset=7'])).toBe(7);
    expect(parsePortOffset(['up', '--port-offset=0'])).toBe(0);
  });

  it.each([
    '--port-offset=',
    '--port-offset',
    '--port-offset=abc',
    '--port-offset=1.5',
    '--port-offset=-1',
  ])('rejects %p with a clear error', (flag) => {
    expect(() => parsePortOffset([flag])).toThrow(/--port-offset/);
  });
});

describe('exitCodeFor', () => {
  it('keeps the exit code of a child that exited', () => {
    expect(exitCodeFor(0, null)).toBe(0);
    expect(exitCodeFor(3, null)).toBe(3);
  });

  it('maps a signal to 128 + the signal number', () => {
    expect(exitCodeFor(null, 'SIGINT')).toBe(130);
    expect(exitCodeFor(null, 'SIGTERM')).toBe(143);
  });

  it('fails when there is neither', () => {
    expect(exitCodeFor(null, null)).toBe(1);
  });
});
