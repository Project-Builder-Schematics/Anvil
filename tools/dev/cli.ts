import { constants } from 'node:os';

export function parsePortOffset(args: string[]): number | undefined {
  const arg = args.find((a) => a.startsWith('--port-offset'));
  if (arg === undefined) return undefined;
  const value = arg.split('=')[1] ?? '';
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `--port-offset needs a non-negative integer (--port-offset=N), got "${value}"`,
    );
  }
  return Number(value);
}

export function exitCodeFor(
  exitCode: number | null,
  signalCode: string | null,
): number {
  if (exitCode !== null) return exitCode;
  const signals: Record<string, number | undefined> = constants.signals;
  const signal = signals[signalCode ?? ''];
  return signal === undefined ? 1 : 128 + signal;
}
