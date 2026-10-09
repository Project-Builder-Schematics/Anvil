import { connect, createServer } from 'node:net';

// A wildcard bind can succeed next to a loopback-only listener, so check both.
export async function isFree(port: number): Promise<boolean> {
  if (await isListening(port)) return false;
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

// `localhost` can resolve to ::1 (dev servers bind either), so probe both loopbacks.
export async function isListening(port: number): Promise<boolean> {
  const probes = ['127.0.0.1', '::1'].map(
    (host) =>
      new Promise<boolean>((resolve) => {
        const socket = connect(port, host);
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => {
          resolve(false);
        });
      }),
  );
  return (await Promise.all(probes)).some(Boolean);
}
