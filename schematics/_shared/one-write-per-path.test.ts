import { describe, expect, it } from 'bun:test';
import { type Directive } from '@pbuilder/sdk/testing';
import hexContext from '../hex-context/factory.ts';
import hexSubdomain from '../hex-subdomain/factory.ts';
import { billingSeed, LIB, run } from './testing.ts';

// The engine takes one write directive per path per run: a second `replaceContent` on a file
// comes back as `path-collision`, which the in-memory harness does not enforce. A subdomain
// with two use cases on one resource is the shape that lands twice on the slice module, the
// context barrel and the controller, so this is where the rule is proven.

/** The author-declared path of a directive, whichever verb it is. */
const pathOf = (directive: Directive): string => {
  switch (directive.op) {
    case 'create':
      return directive.create.pathTemplate;
    case 'modify':
      return directive.modify.path;
    case 'delete':
      return directive.delete.path;
    case 'rename':
      return directive.rename.path;
    case 'move':
      return directive.move.path;
    case 'copy':
      return directive.copy.from;
    case 'copyIn':
      return directive.copyIn.from;
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
    '%s writes each path once across two use cases and two routes',
    async (schematic, factory, input) => {
      const { emitted, error, tree } = await run(
        factory,
        schematic,
        input,
        billingSeed(),
      );

      expect(error).toBeUndefined();
      const written = emitted
        .flatMap((batch) => batch.instructions)
        .map(pathOf);
      expect(twice(written)).toEqual([]);
      // The files several calls land on are still written: one directive carrying every edit.
      expect(written).toContain(`${LIB}/src/index.ts`);
      expect(tree.get(`${LIB}/src/index.ts`)).toContain('ISSUE_INVOICE');
      expect(tree.get(`${LIB}/src/index.ts`)).toContain('VOID_INVOICE');
    },
  );
});
