import { SQL } from 'bun';
import { infraValue, loadInfraEnv } from './infra';
import { isTransientConnectionError, retry } from './retry';
import { deriveIdentity, readGitPaths } from './worktree';

const infra = loadInfraEnv();
const dbName =
  process.env['DB_NAME'] ??
  deriveIdentity(readGitPaths(), undefined, []).dbName;
const user = infraValue(infra, 'DB_USER');
const password = infraValue(infra, 'DB_PASSWORD');
const port = infraValue(infra, 'DB_PORT');

// Runs on every new database and on `dev:seed`: statements go in one transaction and must be upserts.
await retry(
  async () => {
    const sql = new SQL(
      `postgres://${user}:${password}@localhost:${port}/${dbName}`,
    );
    try {
      await sql.begin(async (tx) => {
        await tx`SELECT 1`;
      });
    } finally {
      await sql.close();
    }
  },
  {
    attempts: 5,
    baseMs: 500,
    maxMs: 4000,
    shouldRetry: isTransientConnectionError,
  },
);
console.log(`seed: connected to ${dbName}; no seed data yet`);
