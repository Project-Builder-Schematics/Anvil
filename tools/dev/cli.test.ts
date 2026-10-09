import { describe, expect, it } from 'bun:test';
import type { Identity } from './worktree';
import {
  composeEnv,
  exitCodeFor,
  parseArgs,
  parsePortOffset,
  portClash,
  seedFailureMessage,
  statusLines,
} from './cli';

describe('parsePortOffset', () => {
  it('is undefined when the flag is absent', () => {
    expect(parsePortOffset(['up', '--detach'])).toBeUndefined();
  });

  it('matches the exact flag, not a longer one that starts with it', () => {
    expect(parsePortOffset(['--port-offsets=3'])).toBeUndefined();
    expect(parsePortOffset(['--port-offset-x'])).toBeUndefined();
    expect(parsePortOffset(['up', '--port-offset=3'])).toBe(3);
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

describe('parseArgs', () => {
  it('defaults to up, without detach or an offset', () => {
    expect(parseArgs([])).toEqual({
      command: 'up',
      detach: false,
      portOffset: undefined,
    });
  });

  it('reads the command, --detach and --port-offset in any order', () => {
    expect(parseArgs(['--detach', 'status', '--port-offset=4'])).toEqual({
      command: 'status',
      detach: true,
      portOffset: 4,
    });
  });

  it('refuses a command it does not know, listing the ones it does', () => {
    expect(() => parseArgs(['deploy'])).toThrow(
      'Unknown command "deploy". Use: up | stop | status | logs',
    );
  });

  it('does not mistake a longer flag for --detach', () => {
    expect(parseArgs(['--detached']).detach).toBe(false);
  });
});

const id: Identity = {
  primary: false,
  offset: 7,
  webPort: 4207,
  apiPort: 3007,
  debugPort: 9236,
  composeProject: 'anvil-x-abc123',
  dbName: 'anvil_x_abc123',
};

describe('composeEnv', () => {
  it('layers the worktree identity over the infra env over the shell', () => {
    const env = composeEnv(
      id,
      { DB_USER: 'infra', WEB_PORT: 'no' },
      {
        DB_USER: 'shell',
        PATH: '/bin',
      },
    );

    expect(env).toMatchObject({
      PATH: '/bin',
      DB_USER: 'infra',
      WEB_PORT: '4207',
      API_PORT: '3007',
      DEBUG_PORT: '9236',
      DB_NAME: 'anvil_x_abc123',
      CORS_ORIGIN: 'http://localhost:4207',
    });
  });
});

describe('statusLines', () => {
  it('prints the urls, ports and state of the worktree', () => {
    expect(statusLines(id, { web: true, api: 'stopped' })).toBe(
      [
        'web_url=http://localhost:4207',
        'api_url=http://localhost:3007/api',
        'debug_port=9236',
        'compose_project=anvil-x-abc123',
        'db_name=anvil_x_abc123',
        'web=running',
        'api=stopped',
      ].join('\n'),
    );
  });
});

describe('seedFailureMessage', () => {
  it('says the database was dropped when it was', () => {
    expect(seedFailureMessage('anvil_x', false)).toBe(
      'seed failed; the new database anvil_x was dropped so the next run seeds it again',
    );
  });

  it('says it is still there when the drop failed, so the next run is not trusted to seed it', () => {
    expect(seedFailureMessage('anvil_x', true)).toContain(
      'anvil_x could not be dropped',
    );
  });
});

describe('portClash', () => {
  it('is undefined when every port is free', () => {
    expect(portClash([])).toBeUndefined();
  });

  it('names the taken ports and the way out', () => {
    expect(portClash([4200, 3000])).toBe(
      'Ports in use: 4200, 3000. Retry with --port-offset=<N>.',
    );
  });
});
