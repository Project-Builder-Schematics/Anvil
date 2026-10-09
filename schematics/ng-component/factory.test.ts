import { describe, expect, it } from 'bun:test';
import { run, webLib } from '../_shared/testing.ts';
import factory from './factory.ts';

const UI = 'libs/web/catalog/ui';
const seed = (extra: Record<string, string> = {}) => ({
  ...webLib(UI),
  ...webLib('libs/web/catalog/feature'),
  ...webLib('libs/web/catalog/domain'),
  ...extra,
});
const go = (
  over: Record<string, unknown> = {},
  files: Record<string, string> = seed(),
) =>
  run(factory, 'ng-component', { lib: UI, name: 'order-card', ...over }, files);

const dir = `${UI}/src/lib/order-card`;

describe('ng-component', () => {
  it('writes the four files with no suffix, and exports the component from the barrel', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith(`${dir}/`)).sort(),
    ).toEqual(
      [
        'order-card.css',
        'order-card.html',
        'order-card.spec.ts',
        'order-card.ts',
      ].map((file) => `${dir}/${file}`),
    );
    expect(tree.get(`${UI}/src/index.ts`)).toBe(
      "export * from './lib/order-card/order-card';\n",
    );
  });

  it('groups the files in a shared folder when asked to', async () => {
    const { tree, error } = await go({ folder: 'cards' });

    expect(error).toBeUndefined();
    expect(tree.has(`${UI}/src/lib/cards/order-card.ts`)).toBe(true);
    expect(tree.get(`${UI}/src/lib/cards/order-card.ts`)).toContain(
      "templateUrl: './order-card.html'",
    );
    expect(tree.get(`${UI}/src/index.ts`)).toBe(
      "export * from './lib/cards/order-card';\n",
    );
    expect(String((await go({ folder: 'Cards' })).error)).toContain(
      'dash-case',
    );
  });

  it('follows the Angular 22 component rules', async () => {
    const source =
      (
        await go({ inputs: 'label:string,count:number', outputs: 'selected' })
      ).tree.get(`${dir}/order-card.ts`) ?? '';

    expect(source).toContain(
      "import { Component, input, output } from '@angular/core';",
    );
    expect(source).toContain("selector: 'catalog-order-card'");
    expect(source).toContain("templateUrl: './order-card.html'");
    expect(source).toContain("styleUrl: './order-card.css'");
    expect(source).toContain('export class OrderCard {');
    expect(source).toContain('readonly label = input.required<string>();');
    expect(source).toContain('readonly count = input.required<number>();');
    expect(source).toContain('readonly selected = output();');
    for (const forbidden of [
      'changeDetection',
      'standalone',
      '@Input',
      '@Output',
      'HostBinding',
      'HostListener',
      'NgModule',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('sets the required inputs in the spec so the component renders', async () => {
    const spec =
      (await go({ inputs: 'label:string,count:number,on:boolean' })).tree.get(
        `${dir}/order-card.spec.ts`,
      ) ?? '';

    expect(spec).toContain("fixture.componentRef.setInput('label', 'sample');");
    expect(spec).toContain("fixture.componentRef.setInput('count', 1);");
    expect(spec).toContain("fixture.componentRef.setInput('on', true);");
    expect(spec).toContain("describe('OrderCard'");
  });

  it('refuses a member that is both an input and an output', async () => {
    expect(
      String(
        (await go({ inputs: 'selected:string', outputs: 'selected' })).error,
      ),
    ).toContain('selected is both an input and an output');
  });

  it('writes a component without members when it has no inputs or outputs', async () => {
    const source = (await go()).tree.get(`${dir}/order-card.ts`) ?? '';

    expect(source).toContain("import { Component } from '@angular/core';");
    expect(source).toContain('export class OrderCard {}');
  });

  it('adds a unit-test target to a lib that has none, and leaves an existing one alone', async () => {
    const project = JSON.parse(
      (await go()).tree.get(`${UI}/project.json`) ?? '',
    ) as {
      targets: { test: { executor: string; options: Record<string, unknown> } };
    };

    expect(project.targets.test.executor).toBe('@angular/build:unit-test');
    expect(project.targets.test.options['tsConfig']).toBe(
      `${UI}/tsconfig.spec.json`,
    );
    expect(project.targets.test.options['coverageInclude']).toEqual([
      `${UI}/src/**/*.ts`,
    ]);
    const withTarget = {
      ...seed(),
      [`${UI}/project.json`]:
        '{\n  "name": "x",\n  "prefix": "catalog",\n  "tags": ["type:ui"],\n  "targets": { "test": {} }\n}\n',
    };
    expect((await go({}, withTarget)).tree.has(`${UI}/project.json`)).toBe(
      false,
    );
  });

  it('appends to a barrel that already exports something', async () => {
    const { tree } = await go(
      {},
      seed({ [`${UI}/src/index.ts`]: "export * from './lib/other/other';\n" }),
    );

    expect(tree.get(`${UI}/src/index.ts`)).toBe(
      "export * from './lib/other/other';\nexport * from './lib/order-card/order-card';\n",
    );
  });

  describe('container and presentational', () => {
    const FEATURE = 'libs/web/catalog/feature';

    it('reads the kind from the lib type: feature is a container', async () => {
      const { tree, error } = await go({ lib: FEATURE });

      expect(error).toBeUndefined();
      expect(tree.has(`${FEATURE}/src/lib/order-card/order-card.ts`)).toBe(
        true,
      );
      expect((await go({ lib: FEATURE })).error).toBeUndefined();
    });

    it('gives a container no inputs or outputs', async () => {
      expect(
        String((await go({ lib: FEATURE, inputs: 'label:string' })).error),
      ).toContain('a container takes no inputs or outputs');
      expect(
        String((await go({ lib: FEATURE, outputs: 'selected' })).error),
      ).toContain('a container takes no inputs or outputs');
    });

    it('refuses libs that are neither ui nor feature', async () => {
      expect(
        String((await go({ lib: 'libs/web/catalog/domain' })).error),
      ).toContain('not an Angular lib');
    });
  });

  describe('typed inputs and outputs', () => {
    const typed = {
      inputs: 'lines:OrderLine[],order:Order,label:string',
      outputs: 'added:AddLine,placed',
      type_import: '@demo/web-catalog-domain',
    };

    it('declares custom types and imports them from the given module', async () => {
      const source = (await go(typed)).tree.get(`${dir}/order-card.ts`) ?? '';

      expect(source).toContain(
        "import { Component, input, output } from '@angular/core';\nimport type { AddLine, Order, OrderLine } from '@demo/web-catalog-domain';\n",
      );
      expect(source).toContain(
        'readonly lines = input.required<OrderLine[]>();',
      );
      expect(source).toContain('readonly order = input.required<Order>();');
      expect(source).toContain('readonly label = input.required<string>();');
      expect(source).toContain('readonly added = output<AddLine>();');
      expect(source).toContain('readonly placed = output();');
    });

    it('samples an array input in the spec and leaves other custom inputs unset', async () => {
      const spec =
        (await go(typed)).tree.get(`${dir}/order-card.spec.ts`) ?? '';

      expect(spec).toContain("fixture.componentRef.setInput('lines', []);");
      expect(spec).toContain(
        "fixture.componentRef.setInput('label', 'sample');",
      );
      expect(spec).not.toContain("setInput('order'");
    });

    it('imports nothing when every type is a primitive', async () => {
      const source =
        (
          await go({ inputs: 'label:string', outputs: 'picked:number' })
        ).tree.get(`${dir}/order-card.ts`) ?? '';

      expect(source).not.toContain('import type');
      expect(source).toContain('readonly picked = output<number>();');
    });

    it('imports the types of outputs alone', async () => {
      const source =
        (
          await go({
            outputs: 'added:AddLine',
            type_import: '@demo/web-catalog-domain',
          })
        ).tree.get(`${dir}/order-card.ts`) ?? '';

      expect(source).toContain(
        "import { Component, output } from '@angular/core';\nimport type { AddLine } from '@demo/web-catalog-domain';\n",
      );
      expect(source).toContain('readonly added = output<AddLine>();');
    });

    it.each([
      "x'; process.exit(); '",
      '@demo/x y',
      '@demo/x\nimport',
      '"@demo/x"',
      '/abs/path',
    ])(
      'refuses a type_import that is not a module specifier: %s',
      async (bad) => {
        const { tree, error } = await go({ ...typed, type_import: bad });

        expect(String(error)).toContain('type_import');
        expect([...tree.keys()]).toEqual([]);
      },
    );

    it('accepts a package, a scoped package and a relative path as the module', async () => {
      for (const module of [
        'rxjs',
        '@demo/web-catalog-domain',
        '../domain/src',
      ])
        expect(
          (await go({ ...typed, type_import: module })).error,
        ).toBeUndefined();
    });

    it('refuses a type named like the component class or an Angular import', async () => {
      expect(
        String((await go({ ...typed, inputs: 'a:OrderCard' })).error),
      ).toContain('OrderCard is the component class');
      expect(
        String((await go({ ...typed, outputs: 'picked:Component' })).error),
      ).toContain('Component is imported from @angular/core');
    });

    it('refuses a custom type without a module to import it from', async () => {
      expect(String((await go({ ...typed, type_import: '' })).error)).toContain(
        'type_import',
      );
    });
  });

  it('refuses a component that exists, writing nothing', async () => {
    const { tree, error } = await go(
      {},
      seed({ [`${dir}/order-card.ts`]: 'export {};\n' }),
    );

    expect(String(error)).toContain('src/lib/order-card/');
    expect([...tree.keys()]).toEqual([]);
  });

  it('refuses a missing lib, bad names and unsupported input types', async () => {
    expect(String((await go({ lib: 'libs/web/nope/ui' })).error)).toContain(
      'libs/web/nope/ui/project.json not found',
    );
    expect(String((await go({ name: 'OrderCard' })).error)).toContain(
      'dash-case',
    );
    expect(String((await go({ inputs: 'label:date' })).error)).toContain(
      'string, number, boolean or a PascalCase type',
    );
    expect(String((await go({ outputs: 'Selected' })).error)).toContain(
      'camelCase',
    );
  });
});
