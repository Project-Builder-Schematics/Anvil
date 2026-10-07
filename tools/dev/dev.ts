import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { exitCodeFor, parsePortOffset } from './cli';
import { planDatabase } from './database';
import { infraValue, loadInfraEnv } from './infra';
import { isFree, isListening } from './net';
import { deriveIdentity, readGitPaths, type Identity } from './worktree';

const SHARED_PROJECT = 'demo';
const NETWORK = 'demo-shared-net';
const PID_FILE = '.dev/web.pid';
const LOG_FILE = '.dev/web.log';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) ?? 'up';
const detach = args.includes('--detach');

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const infra = loadInfraEnv();
const dbUser = infraValue(infra, 'DB_USER');
let id: Identity;
try {
  id = deriveIdentity(readGitPaths(), parsePortOffset(args), [
    Number(infraValue(infra, 'DB_PORT')),
    Number(infraValue(infra, 'PGADMIN_PORT')),
  ]);
} catch (error) {
  fail(error);
}
const env = {
  ...process.env,
  ...infra,
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

function ensureSharedInfra() {
  const networkExists = () =>
    Bun.spawnSync(['docker', 'network', 'inspect', NETWORK]).exitCode === 0;
  if (!networkExists()) {
    try {
      docker('network', 'create', NETWORK);
    } catch (error) {
      // Another worktree starting at the same time may have created it first.
      if (!networkExists()) throw error;
    }
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
      dbUser,
      '-d',
      'postgres',
      ...psqlArgs,
    );
  const plan = planDatabase(
    psql('-tAc', `SELECT 1 FROM pg_database WHERE datname='${id.dbName}'`),
  );
  if (plan.create) psql('-c', `CREATE DATABASE "${id.dbName}"`);
  return {
    seed: plan.seed,
    dropDatabase: () =>
      psql('-c', `DROP DATABASE IF EXISTS "${id.dbName}" WITH (FORCE)`),
  };
}

async function up(): Promise<number> {
  await stopWeb();
  const infraState = ensureSharedInfra();
  if (infraState.seed) {
    const result = Bun.spawnSync(['bun', 'tools/dev/seed.ts'], {
      env,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    if (result.exitCode !== 0) {
      // The database is only seeded when it is created, so a half-seeded one would never be retried.
      infraState.dropDatabase();
      throw new Error(
        'seed failed; the new database was dropped so the next run seeds it again',
      );
    }
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

  let keepRunning = false;
  try {
    if (detach) {
      await startDetached();
      keepRunning = true;
      return 0;
    }
    return await runForeground();
  } finally {
    if (!keepRunning) {
      await stop().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
      });
    }
  }
}

const serve = () => ['bunx', 'nx', 'serve', 'web', `--port=${id.webPort}`];

async function startDetached() {
  mkdirSync('.dev', { recursive: true });
  const log = openSync(LOG_FILE, 'w');
  const web = Bun.spawn(serve(), {
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
}

async function runForeground(): Promise<number> {
  const web = Bun.spawn(serve(), {
    env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      web.kill(signal);
    });
  }
  await web.exited;
  return exitCodeFor(web.exitCode, web.signalCode);
}

async function stopWeb() {
  const pid = readWebPid();
  if (pid !== undefined) {
    process.kill(-pid, 'SIGTERM');
    if (!(await waitFor(() => startedAt(pid) === '', 5_000)))
      process.kill(-pid, 'SIGKILL');
  }
  rmSync(PID_FILE, { force: true });
}

async function stop() {
  await stopWeb();
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
  const code = await run();
  if (typeof code === 'number') process.exit(code);
} catch (error) {
  fail(error);
}
