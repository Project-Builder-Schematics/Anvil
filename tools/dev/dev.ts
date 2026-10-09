import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  type Command,
  composeEnv,
  exitCodeFor,
  parseArgs,
  portClash,
  seedFailureMessage,
  statusLines,
} from './cli';
import { planDatabase } from './database';
import { infraValue, loadInfraEnv, sharedPorts } from './infra';
import { isFree, isListening } from './net';
import { deriveIdentity, readGitPaths, type Identity } from './worktree';

const SHARED_PROJECT = 'anvil';
const NETWORK = 'anvil-shared-net';
const PID_FILE = '.dev/web.pid';
const LOG_FILE = '.dev/web.log';

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

let options: ReturnType<typeof parseArgs>;
let infra: Record<string, string>;
let dbUser: string;
let id: Identity;
try {
  options = parseArgs(process.argv.slice(2));
  infra = loadInfraEnv();
  dbUser = infraValue(infra, 'DB_USER');
  id = deriveIdentity(readGitPaths(), options.portOffset, sharedPorts(infra));
} catch (error) {
  fail(error);
}
const { command, detach } = options;
const env = composeEnv(id, infra, process.env);

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
      let dropFailed = false;
      try {
        infraState.dropDatabase();
      } catch (error) {
        dropFailed = true;
        console.error(error instanceof Error ? error.message : error);
      }
      throw new Error(seedFailureMessage(id.dbName, dropFailed));
    }
  }

  compose(id.composeProject, 'rm', '-sf', 'api');
  const taken: number[] = [];
  for (const port of [id.webPort, id.apiPort, id.debugPort]) {
    if (!(await isFree(port))) taken.push(port);
  }
  const clash = portClash(taken);
  if (clash) throw new Error(clash);
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
  console.log(statusLines(id, { web: readWebPid() !== undefined, api }));
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

const commands: Record<Command, () => unknown> = { up, stop, status, logs };
try {
  const code = await commands[command]();
  if (typeof code === 'number') process.exit(code);
} catch (error) {
  fail(error);
}
