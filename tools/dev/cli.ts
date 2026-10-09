import { constants } from 'node:os';
import type { Identity } from './worktree';

export const COMMANDS = ['up', 'stop', 'status', 'logs'] as const;
export type Command = (typeof COMMANDS)[number];

export function parsePortOffset(args: string[]): number | undefined {
  const arg = args.find(
    (a) => a === '--port-offset' || a.startsWith('--port-offset='),
  );
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

export function parseArgs(args: string[]): {
  command: Command;
  detach: boolean;
  portOffset: number | undefined;
} {
  const name = args.find((arg) => !arg.startsWith('--')) ?? 'up';
  const command = COMMANDS.find((known) => known === name);
  if (command === undefined) {
    throw new Error(
      `Unknown command "${name}". Use: ${COMMANDS.join(' | ')} [--detach] [--port-offset=N]`,
    );
  }
  return {
    command,
    detach: args.includes('--detach'),
    portOffset: parsePortOffset(args),
  };
}

export function composeEnv(
  id: Identity,
  infra: Record<string, string>,
  base: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...base,
    ...infra,
    WEB_PORT: String(id.webPort),
    API_PORT: String(id.apiPort),
    DEBUG_PORT: String(id.debugPort),
    DB_NAME: id.dbName,
    CORS_ORIGIN: `http://localhost:${id.webPort}`,
  };
}

export function statusLines(
  id: Identity,
  state: { web: boolean; api: string },
): string {
  return [
    `web_url=http://localhost:${id.webPort}`,
    `api_url=http://localhost:${id.apiPort}/api`,
    `debug_port=${id.debugPort}`,
    `compose_project=${id.composeProject}`,
    `db_name=${id.dbName}`,
    `web=${state.web ? 'running' : 'stopped'}`,
    `api=${state.api}`,
  ].join('\n');
}

// The database is only seeded when it is created, so a half-seeded one that stays would never be retried.
export function seedFailureMessage(
  dbName: string,
  dropFailed: boolean,
): string {
  return dropFailed
    ? `seed failed and the new database ${dbName} could not be dropped; drop it by hand or the next run will skip seeding it`
    : `seed failed; the new database ${dbName} was dropped so the next run seeds it again`;
}

export function portClash(taken: number[]): string | undefined {
  return taken.length > 0
    ? `Ports in use: ${taken.join(', ')}. Retry with --port-offset=<N>.`
    : undefined;
}
