import { describe, expect, it } from 'bun:test';
import { type Directive } from '@pbuilder/sdk/testing';
import hexContext from '../hex-context/factory.ts';
import hexSubdomain from '../hex-subdomain/factory.ts';
import { billingSeed, LIB, run } from './testing.ts';

// The engine accepts one `create` and one `modify` directive per path per run: a second
// `modify` on a file comes back as `path-collision`, which the in-memory harness does not
// enforce. A subdomain with two use cases on one resource is the shape that lands twice on the
// slice module, the context barrel and the controller, so this is where the rule is proven.
// A file the run creates may also be edited once (create, then modify).

/** The verb and the author-declared path of a directive. */
const keyOf = (directive: Directive): string => {
  switch (directive.op) {
    case 'create':
      return `create ${directive.create.pathTemplate}`;
    case 'modify':
      return `modify ${directive.modify.path}`;
    case 'delete':
      return `delete ${directive.delete.path}`;
    case 'rename':
      return `rename ${directive.rename.path}`;
    case 'move':
      return `move ${directive.move.path}`;
    case 'copy':
      return `copy ${directive.copy.from}`;
    case 'copyIn':
      return `copyIn ${directive.copyIn.from}`;
  }
};

const twice = (paths: string[]): string[] => [
  ...new Set(paths.filter((path, i) => paths.indexOf(path) !== i)),
];

describe('one write directive per path per run', () => {
  it.each([
    ['hex-subdomain', hexSubdomain, { context: 'billing', slice: 'invoicing' }],
    ['hex-context', hexContext, { context: 'billing' }],
  ] as const)(
    '%s modifies and creates each path once across two use cases and two routes',
    async (schematic, factory, input) => {
      const { emitted, error, tree } = await run(
        factory,
        schematic,
        input,
        billingSeed(),
      );

      expect(error).toBeUndefined();
      const written = emitted.flatMap((batch) => batch.instructions).map(keyOf);
      expect(twice(written)).toEqual([]);
      // The files several calls land on are still written: one directive carrying every edit.
      expect(written).toContain(`modify ${LIB}/src/index.ts`);
      expect(tree.get(`${LIB}/src/index.ts`)).toContain('ISSUE_INVOICE');
      expect(tree.get(`${LIB}/src/index.ts`)).toContain('VOID_INVOICE');
    },
  );
});
