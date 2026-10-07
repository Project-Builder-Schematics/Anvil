import { describe, expect, it } from 'bun:test';
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { contractVars } from '../../libs/web/shared/design-system/src/tokens/contract';

describe('component styles', () => {
  const files = [...new Glob('libs/web/**/src/**/*.css').scanSync('.')].filter(
    (file) => !file.endsWith('themes.generated.css'),
  );

  it('are scanned (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s only uses tokens from the contract', (file) => {
    const used = readFileSync(file, 'utf8').match(/--ds-[a-z-]+/g) ?? [];
    expect(used.filter((name) => !contractVars.includes(name))).toEqual([]);
  });
});
