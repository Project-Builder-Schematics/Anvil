import { describe, expect, it } from 'bun:test';
import { lstatSync, readFileSync } from 'node:fs';

// The project is called Anvil. Files that record history (lockfile, ODD task logs, the impact log)
// or that this suite cannot read keep the old name.
const root = `${import.meta.dir}/../..`;
const allowed = [
  /^\.env\.example$/,
  /^bun\.lock$/,
  /^odd\//,
  /^schematics\/IMPACT\.md$/,
];
const MIN_FILES = 200;

// Built from parts so this file does not match its own patterns.
const old = 'de' + 'mo';
const forbidden: [string, RegExp][] = [
  ['the old npm scope', new RegExp(`@${old}/`)],
  ['the old shared network', new RegExp(`${old}-shared-net`)],
  [
    'a compose project named after the old name',
    new RegExp(`(-p |project [\`"']?)${old}\\b`),
  ],
  [
    'a per-worktree project pattern with the old name',
    new RegExp(`${old}-<slug>`),
  ],
];

const tracked = (): string[] => {
  const { stdout, exitCode } = Bun.spawnSync(['git', 'ls-files', '-z'], {
    cwd: root,
  });
  if (exitCode !== 0) throw new Error('git ls-files failed');
  return stdout.toString().split('\0').filter(Boolean);
};

describe('the project name', () => {
  const files = tracked().filter(
    (path) =>
      !allowed.some((re) => re.test(path)) &&
      lstatSync(`${root}/${path}`).isFile(),
  );

  it('scans enough files to mean something', () => {
    expect(files.length).toBeGreaterThan(MIN_FILES);
  });

  it.each(forbidden)(
    'does not use %s outside the allowlist',
    (_label, pattern) => {
      const hits = files.filter((path) => {
        const text = readFileSync(`${root}/${path}`);
        return !text.includes(0) && pattern.test(text.toString('utf8'));
      });
      expect(hits).toEqual([]);
    },
  );
});
