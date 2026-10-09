import { describe, expect, it } from 'bun:test';
import { planDatabase } from './database';

describe('planDatabase', () => {
  it('creates and seeds a database that does not exist yet', () => {
    expect(planDatabase('')).toEqual({ create: true, seed: true });
    expect(planDatabase('\n')).toEqual({ create: true, seed: true });
  });

  it('never creates or re-seeds an existing database', () => {
    expect(planDatabase('1\n')).toEqual({ create: false, seed: false });
  });
});
