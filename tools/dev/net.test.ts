import { afterEach, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:net';
import { isFree, isListening } from './net';

const servers: Server[] = [];

function listen(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    servers.push(server);
    server.once('error', reject);
    server.listen(0, host, () => {
      resolve((server.address() as { port: number }).port);
    });
  });
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe('isListening', () => {
  it('sees an IPv4 listener', async () => {
    expect(await isListening(await listen('127.0.0.1'))).toBe(true);
  });

  it('sees an IPv6-only listener, which is where localhost can resolve', async () => {
    const port = await listen('::1').catch(() => undefined);
    if (port === undefined) return;
    expect(await isListening(port)).toBe(true);
  });

  it('is false for a port nobody listens on', async () => {
    const port = await listen('127.0.0.1');
    servers.pop()?.close();
    expect(await isListening(port)).toBe(false);
  });
});

describe('isFree', () => {
  it('is false for a bound port and true once released', async () => {
    const port = await listen('127.0.0.1');
    expect(await isFree(port)).toBe(false);
    servers.pop()?.close();
    expect(await isFree(port)).toBe(true);
  });
});
