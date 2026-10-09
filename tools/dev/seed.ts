import { SQL } from 'bun';
import { databaseUrl, loadInfraEnv, sharedPorts } from './infra';
import { isTransientConnectionError, retry } from './retry';
import { deriveIdentity, readGitPaths } from './worktree';

const infra = loadInfraEnv();
const dbName =
  process.env['DB_NAME'] ??
  deriveIdentity(readGitPaths(), undefined, sharedPorts(infra)).dbName;
const url = databaseUrl(infra, dbName);

// Runs on every new database and on `dev:seed`: statements go in one transaction and must be upserts.
await retry(
  async () => {
    const sql = new SQL(url);
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
