import { describe, expect, it } from 'bun:test';
import { deriveIdentity } from './worktree';

const primary = {
  toplevel: '/work/demo',
  gitDir: '/work/demo/.git',
  commonDir: '/work/demo/.git',
};
const shared = [5432, 5050];
const linked = {
  toplevel: '/work/demo-feat/Checkout Flow!',
  gitDir: '/work/demo/.git/worktrees/x',
  commonDir: '/work/demo/.git',
};

describe('deriveIdentity', () => {
  it('uses base ports and the shared names for the primary checkout', () => {
    expect(deriveIdentity(primary, undefined, shared)).toMatchObject({
      primary: true,
      offset: 0,
      webPort: 4200,
      apiPort: 3000,
      debugPort: 9229,
      composeProject: 'demo',
      dbName: 'demo',
    });
  });

  it('derives a stable offset in 2..199 and hashed names for a linked worktree', () => {
    const first = deriveIdentity(linked, undefined, shared);
    expect(deriveIdentity(linked, undefined, shared)).toEqual(first);
    expect(first.primary).toBe(false);
    expect(first.offset).toBeGreaterThanOrEqual(2);
    expect(first.offset).toBeLessThan(200);
    expect(first.apiPort).toBe(3000 + first.offset);
    expect(first.composeProject).toMatch(/^demo-checkout_flow_-[0-9a-f]{6}$/);
    expect(first.dbName).toMatch(/^demo_checkout_flow__[0-9a-f]{6}$/);
  });

  it('cuts the slug to 24 characters', () => {
    const long = { ...linked, toplevel: '/w/' + 'a'.repeat(40) };
    expect(deriveIdentity(long, undefined, shared).composeProject).toMatch(
      /^demo-a{24}-[0-9a-f]{6}$/,
    );
  });

  it('lets --port-offset override the derived offset', () => {
    expect(deriveIdentity(linked, 7, shared)).toMatchObject({
      offset: 7,
      webPort: 4207,
      apiPort: 3007,
    });
  });

  it.each([-1, 1000, 1.5])('rejects the offset %p', (offset) => {
    expect(() => deriveIdentity(primary, offset, shared)).toThrow(/0 and 999/);
  });

  it('rejects an offset that lands on a shared-infra port', () => {
    expect(() => deriveIdentity(primary, 850, shared)).toThrow(/5050/);
    expect(() => deriveIdentity(primary, 850, [9999])).not.toThrow();
  });
});
