import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export interface GitPaths {
  toplevel: string;
  gitDir: string;
  commonDir: string;
}

export interface Identity {
  primary: boolean;
  offset: number;
  webPort: number;
  apiPort: number;
  debugPort: number;
  composeProject: string;
  dbName: string;
}

export function deriveIdentity(
  git: GitPaths,
  portOffset: number | undefined,
  sharedPorts: readonly number[],
): Identity {
  const primary = git.gitDir === git.commonDir;
  const hash = createHash('sha256')
    .update(git.toplevel)
    .digest('hex')
    .slice(0, 6);
  const slug = basename(git.toplevel)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 24);

  const offset = portOffset ?? (primary ? 0 : 2 + (parseInt(hash, 16) % 198));
  if (!Number.isInteger(offset) || offset < 0 || offset > 999) {
    throw new Error(
      `Port offset must be an integer between 0 and 999, got ${offset}`,
    );
  }

  const identity: Identity = {
    primary,
    offset,
    webPort: 4200 + offset,
    apiPort: 3000 + offset,
    debugPort: 9229 + offset,
    composeProject: primary ? 'demo' : `demo-${slug}-${hash}`,
    dbName: primary ? 'demo' : `demo_${slug}_${hash}`,
  };

  const clash = [identity.webPort, identity.apiPort, identity.debugPort].find(
    (port) => sharedPorts.includes(port),
  );
  if (clash !== undefined) {
    throw new Error(
      `Port ${clash} is reserved for shared infra; pick another --port-offset`,
    );
  }
  return identity;
}

export function readGitPaths(): GitPaths {
  const result = Bun.spawnSync([
    'git',
    'rev-parse',
    '--path-format=absolute',
    '--show-toplevel',
    '--git-dir',
    '--git-common-dir',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`git rev-parse failed: ${result.stderr.toString().trim()}`);
  }
  const [toplevel, gitDir, commonDir] = result.stdout
    .toString()
    .trim()
    .split('\n');
  if (!toplevel || !gitDir || !commonDir) {
    throw new Error('Unexpected git rev-parse output');
  }
  return { toplevel, gitDir, commonDir };
}
