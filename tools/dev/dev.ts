import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { connect, createServer } from 'node:net';
import { planDatabase } from './database';
import { deriveIdentity, readGitPaths } from './worktree';

const SHARED_PROJECT = 'demo';
const NETWORK = 'demo-shared-net';
const DB_USER = process.env['DB_USER'] ?? 'demo';
const PID_FILE = '.dev/web.pid';
const LOG_FILE = '.dev/web.log';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) ?? 'up';
const detach = args.includes('--detach');
const offsetFlag = args
  .find((arg) => arg.startsWith('--port-offset='))
  ?.split('=')[1];

const id = deriveIdentity(
  readGitPaths(),
  offsetFlag === undefined ? undefined : Number(offsetFlag),
);
const env = {
  ...process.env,
  WEB_PORT: String(id.webPort),
  API_PORT: String(id.apiPort),
  DEBUG_PORT: String(id.debugPort),
  DB_NAME: id.dbName,
  CORS_ORIGIN: `http://localhost:${id.webPort}`,
};

function docker(...dockerArgs: string[]): string {
  const result = Bun.spawnSync(['docker', ...dockerArgs], { env });
  if (result.exitCode !== 0) {
    throw new Error(
      `docker ${dockerArgs.join(' ')} failed: ${result.stderr.toString().trim()}\nIs Docker running?`,
    );
  }
  return result.stdout.toString();
}

const compose = (project: string, ...rest: string[]) =>
  docker('compose', '-p', project, ...rest);

function isFree(port: number): Promise<boolean> {
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

function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await Bun.sleep(250);
  }
  return false;
}

const startedAt = (pid: number) =>
  Bun.spawnSync(['ps', '-o', 'lstart=', '-p', String(pid)])
    .stdout.toString()
    .trim();

function readWebPid(): number | undefined {
  if (!existsSync(PID_FILE)) return undefined;
  const saved = JSON.parse(readFileSync(PID_FILE, 'utf8')) as {
    pid: number;
    startedAt: string;
  };
  return startedAt(saved.pid) === saved.startedAt ? saved.pid : undefined;
}

function ensureSharedInfra(): boolean {
  if (Bun.spawnSync(['docker', 'network', 'inspect', NETWORK]).exitCode !== 0) {
    docker('network', 'create', NETWORK);
  }
  compose(SHARED_PROJECT, 'up', '-d', '--wait', 'db', 'pgadmin');

  const psql = (...psqlArgs: string[]) =>
    compose(
      SHARED_PROJECT,
      'exec',
      '-T',
      'db',
      'psql',
      '-U',
      DB_USER,
      '-d',
      'postgres',
      ...psqlArgs,
    );
  const plan = planDatabase(
    psql('-tAc', `SELECT 1 FROM pg_database WHERE datname='${id.dbName}'`),
  );
  if (plan.create) psql('-c', `CREATE DATABASE "${id.dbName}"`);
  return plan.seed;
}

async function up() {
  const seed = ensureSharedInfra();
  if (seed) {
    const result = Bun.spawnSync(['bun', 'tools/dev/seed.ts'], {
      env,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    if (result.exitCode !== 0) throw new Error('seed failed');
  }

  compose(id.composeProject, 'rm', '-sf', 'api');
  const taken: number[] = [];
  for (const port of [id.webPort, id.apiPort, id.debugPort]) {
    if (!(await isFree(port))) taken.push(port);
  }
  if (taken.length > 0) {
    throw new Error(
      `Ports in use: ${taken.join(', ')}. Retry with --port-offset=<N>.`,
    );
  }
  compose(id.composeProject, 'up', '-d', '--force-recreate', 'api');

  const serve = ['bunx', 'nx', 'serve', 'web', `--port=${id.webPort}`];
  if (detach) {
    mkdirSync('.dev', { recursive: true });
    const log = openSync(LOG_FILE, 'w');
    const web = Bun.spawn(serve, {
      env,
      detached: true,
      stdio: ['ignore', log, log],
    });
    closeSync(log);
    web.unref();
    writeFileSync(
      PID_FILE,
      JSON.stringify({ pid: web.pid, startedAt: startedAt(web.pid) }),
    );
    if (!(await waitFor(() => isListening(id.webPort), 30_000))) {
      throw new Error(
        `web did not listen on ${id.webPort} within 30s; see ${LOG_FILE}`,
      );
    }
    status();
    return;
  }

  const web = Bun.spawn(serve, {
    env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  process.once('SIGINT', () => {
    web.kill();
    compose(id.composeProject, 'stop', 'api');
    process.exit(0);
  });
  await web.exited;
}

async function stop() {
  const pid = readWebPid();
  if (pid !== undefined) {
    process.kill(-pid, 'SIGTERM');
    if (!(await waitFor(() => startedAt(pid) === '', 5_000)))
      process.kill(-pid, 'SIGKILL');
  }
  rmSync(PID_FILE, { force: true });
  compose(id.composeProject, 'stop', 'api');
}

function status() {
  let api: string;
  try {
    api = compose(
      id.composeProject,
      'ps',
      '--status',
      'running',
      '-q',
      'api',
    ).trim()
      ? 'running'
      : 'stopped';
  } catch {
    api = 'unknown (is Docker running?)';
  }
  console.log(
    [
      `web_url=http://localhost:${id.webPort}`,
      `api_url=http://localhost:${id.apiPort}/api`,
      `debug_port=${id.debugPort}`,
      `compose_project=${id.composeProject}`,
      `db_name=${id.dbName}`,
      `web=${readWebPid() === undefined ? 'stopped' : 'running'}`,
      `api=${api}`,
    ].join('\n'),
  );
}

function logs() {
  if (existsSync(LOG_FILE))
    Bun.spawnSync(['tail', '-n', '50', LOG_FILE], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
  Bun.spawnSync(
    [
      'docker',
      'compose',
      '-p',
      id.composeProject,
      'logs',
      '-f',
      '--tail',
      '100',
      'api',
    ],
    {
      env,
      stdio: ['inherit', 'inherit', 'inherit'],
    },
  );
}

const commands: Record<string, () => unknown> = { up, stop, status, logs };
const run = commands[command];
if (!run) {
  console.error(
    `Unknown command "${command}". Use: ${Object.keys(commands).join(' | ')} [--detach] [--port-offset=N]`,
  );
  process.exit(1);
}
try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
