import { describe, expect, it } from 'bun:test';
import { run, webLib } from '../_shared/testing.ts';
import factory from './factory.ts';

const LIB = 'libs/web/catalog/data-access';
const seed = (extra: Record<string, string> = {}) => ({
  ...webLib(LIB),
  ...webLib('libs/web/catalog/ui'),
  ...webLib('libs/web/catalog/domain'),
  ...extra,
});
const go = (
  over: Record<string, unknown> = {},
  files: Record<string, string> = seed(),
) =>
  run(factory, 'ng-service', { lib: LIB, name: 'order-store', ...over }, files);

const dir = `${LIB}/src/lib/order-store`;

describe('ng-service', () => {
  it('writes a root-provided service and its spec, and exports it from the barrel', async () => {
    const { tree, error } = await go();

    expect(error).toBeUndefined();
    expect(
      [...tree.keys()].filter((path) => path.startsWith(`${dir}/`)).sort(),
    ).toEqual([`${dir}/order-store.spec.ts`, `${dir}/order-store.ts`]);
    expect(tree.get(`${dir}/order-store.ts`)).toBe(
      "import { Service } from '@angular/core';\n\n@Service()\nexport class OrderStore {}\n",
    );
    expect(tree.get(`${LIB}/src/index.ts`)).toBe(
      "export * from './lib/order-store/order-store';\n",
    );
  });

  it('groups the files in a shared folder when asked to', async () => {
    const { tree } = await go({ folder: 'orders' });

    expect(tree.has(`${LIB}/src/lib/orders/order-store.ts`)).toBe(true);
    expect(tree.has(`${LIB}/src/lib/orders/order-store.spec.ts`)).toBe(true);
    expect(tree.get(`${LIB}/src/index.ts`)).toBe(
      "export * from './lib/orders/order-store';\n",
    );
  });

  it('keeps each state field in a private writable signal exposed as readonly', async () => {
    const source =
      (
        await go({
          fields: 'count:number,label:string,done:boolean,ids:string[]',
        })
      ).tree.get(`${dir}/order-store.ts`) ?? '';

    expect(source).toContain(
      "import { Service, signal } from '@angular/core';",
    );
    expect(source).toContain('private readonly _count = signal<number>(0);');
    expect(source).toContain('readonly count = this._count.asReadonly();');
    expect(source).toContain("private readonly _label = signal<string>('');");
    expect(source).toContain(
      'private readonly _done = signal<boolean>(false);',
    );
    expect(source).toContain('private readonly _ids = signal<string[]>([]);');
  });

  it('asserts the initial state in the spec', async () => {
    const spec =
      (await go({ fields: 'count:number,ids:string[]' })).tree.get(
        `${dir}/order-store.spec.ts`,
      ) ?? '';

    expect(spec).toContain('const service = TestBed.inject(OrderStore);');
    expect(spec).toContain('expect(service.count()).toBe(0);');
    expect(spec).toContain('expect(service.ids()).toEqual([]);');
  });

  it('adds a unit-test target to a lib that has none', async () => {
    const project = JSON.parse(
      (await go()).tree.get(`${LIB}/project.json`) ?? '',
    ) as { targets: { test: { executor: string } } };

    expect(project.targets.test.executor).toBe('@angular/build:unit-test');
  });

  it('also serves a ui lib, where the design system keeps its experiment service, but not a domain lib', async () => {
    expect((await go({ lib: 'libs/web/catalog/ui' })).error).toBeUndefined();
    expect(
      String((await go({ lib: 'libs/web/catalog/domain' })).error),
    ).toContain('not an Angular lib');
  });

  it('refuses a service that exists, a missing lib, bad names and unsupported field types', async () => {
    expect(
      String(
        (await go({}, seed({ [`${dir}/order-store.ts`]: 'export {};\n' })))
          .error,
      ),
    ).toContain('src/lib/order-store/');
    expect(
      String((await go({ lib: 'libs/web/nope/data-access' })).error),
    ).toContain('project.json not found');
    expect(String((await go({ name: 'OrderStore' })).error)).toContain(
      'dash-case',
    );
    expect(String((await go({ fields: 'when:Date' })).error)).toContain(
      'string, number or boolean',
    );
  });
});
