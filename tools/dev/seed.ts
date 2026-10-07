import { SQL } from 'bun';
import { readGitPaths, deriveIdentity } from './worktree';

const dbName = process.env['DB_NAME'] ?? deriveIdentity(readGitPaths()).dbName;
const user = process.env['DB_USER'] ?? 'demo';
const password = process.env['DB_PASSWORD'] ?? 'demo';
const port = process.env['DB_PORT'] ?? '5432';

const sql = new SQL(
  `postgres://${user}:${password}@localhost:${port}/${dbName}`,
);
try {
  await sql`SELECT 1`;
  console.log(`seed: connected to ${dbName}; no seed data yet`);
} finally {
  await sql.close();
}
