import { describe, expect, it } from 'bun:test';
import { run, webLib } from '../_shared/testing.ts';
import factory from './factory.ts';

const LIB = 'libs/web/catalog/ui';
const seed = (extra: Record<string, string> = {}) => ({
  ...webLib(LIB),
  ...webLib('libs/web/catalog/feature'),
  ...extra,
});
const go = (
  over: Record<string, unknown> = {},
  files: Record<string, string> = seed(),
) =>
  run(factory, 'ng-directive', { lib: LIB, name: 'highlight', ...over }, files);

const dir = `${LIB}/src/lib/highlight`;

describe('ng-directive', () => {
  it('writes an attribute directive named after the lib prefix, as the lint rules require', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(tree.get(`${dir}/highlight.ts`)).toBe(
      "import { Directive } from '@angular/core';\n\n@Directive({ selector: '[catalogHighlight]' })\nexport class CatalogHighlight {}\n",
    );
    expect(tree.get(`${LIB}/src/index.ts`)).toBe(
      "export * from './lib/highlight/highlight';\n",
    );
  });

  it('groups the files in a shared folder when asked to', async () => {
    const { tree } = await go({ folder: 'effects' });

    expect(tree.has(`${LIB}/src/lib/effects/highlight.ts`)).toBe(true);
    expect(tree.get(`${LIB}/src/index.ts`)).toBe(
      "export * from './lib/effects/highlight';\n",
    );
  });

  it('names a directive of a prefix-only lib the way the design system does', async () => {
    const { tree } = await go(
      { lib: 'libs/web/shared/design-system', name: 'variant' },
      webLib('libs/web/shared/design-system'),
    );

    expect(
      tree.get('libs/web/shared/design-system/src/lib/variant/variant.ts'),
    ).toContain("selector: '[dsVariant]'");
    expect(
      tree.get('libs/web/shared/design-system/src/lib/variant/variant.ts'),
    ).toContain('export class DsVariant {}');
  });

  it('applies the directive to a host element in the spec', async () => {
    const spec = (await go()).tree.get(`${dir}/highlight.spec.ts`) ?? '';

    expect(spec).toContain(
      '@Component({\n  imports: [CatalogHighlight],\n  template: `<div catalogHighlight></div>`,\n})',
    );
    expect(spec).toContain('By.directive(CatalogHighlight)');
  });

  it('adds a unit-test target to a lib that has none', async () => {
    const project = JSON.parse(
      (await go()).tree.get(`${LIB}/project.json`) ?? '',
    ) as { targets: { test: { executor: string } } };

    expect(project.targets.test.executor).toBe('@angular/build:unit-test');
  });

  it('refuses libs that are not ui libs', async () => {
    expect(
      String((await go({ lib: 'libs/web/catalog/feature' })).error),
    ).toContain('web-catalog-feature is a feature lib');
  });

  it('refuses a directive that exists, a missing lib and a bad name', async () => {
    expect(
      String(
        (await go({}, seed({ [`${dir}/highlight.ts`]: 'export {};\n' }))).error,
      ),
    ).toContain('src/lib/highlight/');
    expect(String((await go({ lib: 'libs/web/nope/ui' })).error)).toContain(
      'project.json not found',
    );
    expect(String((await go({ name: 'Highlight' })).error)).toContain(
      'dash-case',
    );
  });
});
