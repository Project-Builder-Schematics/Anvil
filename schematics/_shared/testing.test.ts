import { describe, expect, it } from 'bun:test';
import { create } from '@pbuilder/sdk/commons';
import { find } from '@pbuilder/sdk/typescript';
import { runFactory } from './testing.ts';

describe('runFactory', () => {
  it('renders a created file as the engine does, so a later edit in the same run reads the result', async () => {
    const { error, tree } = await runFactory(
      async () => {
        create('a.ts', {
          template: 'export class {= .cls =} {}\n',
          options: { cls: 'Thing' },
        });
        await find('a.ts').modify((ast) => {
          ast
            .getClassOrThrow('Thing')
            .addProperty({ name: 'x', type: 'number' });
        });
      },
      {},
      {},
    );

    expect(error).toBeUndefined();
    expect(tree.get('a.ts')).toContain('export class Thing {');
    expect(tree.get('a.ts')).toContain('x: number;');
  });

  it('renders the path of a created file too', async () => {
    const { tree } = await runFactory(
      () => {
        create('{= .dir =}/a.txt', { template: 'hi', options: { dir: 'out' } });
      },
      {},
      {},
    );

    expect([...tree.keys()]).toEqual(['out/a.txt']);
  });

  it('keeps the unrendered directives, which is what the engine is sent', async () => {
    const { emitted } = await runFactory(
      () => {
        create('a.txt', { template: '{= .x =}', options: { x: 'y' } });
      },
      {},
      {},
    );

    expect(emitted[0]?.instructions[0]).toMatchObject({
      op: 'create',
      create: { template: '{= .x =}' },
    });
  });
});
