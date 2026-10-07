import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import {
  parseInputs,
  parseNames,
  readNgLib,
  withBarrelExport,
  withTestTarget,
} from './ng.ts';
import { writeBuffer } from './lib.ts';

describe('parseInputs', () => {
  it('reads typed camelCase inputs', () => {
    expect(parseInputs('label:string, count:number')).toEqual([
      { name: 'label', type: 'string' },
      { name: 'count', type: 'number' },
    ]);
  });

  it('refuses a name or type the generated specs cannot fill', () => {
    expect(() => parseInputs('Label:string')).toThrow('camelCase');
    expect(() => parseInputs('label:Date')).toThrow(
      'string, number or boolean',
    );
  });

  it('refuses the same input twice', () => {
    expect(() => parseInputs('label:string,label:number')).toThrow(
      'label is listed twice',
    );
  });
});

describe('parseNames', () => {
  it('reads camelCase names', () => {
    expect(parseNames('selected, closed', 'output')).toEqual([
      'selected',
      'closed',
    ]);
  });

  it('refuses a name in the wrong case and a repeated one', () => {
    expect(() => parseNames('Selected', 'output')).toThrow('camelCase');
    expect(() => parseNames('selected,selected', 'output')).toThrow(
      'output selected is listed twice',
    );
  });
});

describe('withTestTarget', () => {
  const dir = 'libs/web/catalog/ui';

  it('adds the unit-test target to a project without targets', () => {
    const out = withTestTarget('{\n  "name": "x"\n}\n', dir);

    expect(JSON.parse(out)).toMatchObject({
      targets: { test: { executor: '@angular/build:unit-test' } },
    });
  });

  it('leaves a project that has a test target as it is', () => {
    const project = '{"name":"x","targets":{"test":{}}}';

    expect(withTestTarget(project, dir)).toBe(project);
  });

  it('adds the target next to other targets', () => {
    const out = withTestTarget('{"name":"x","targets":{"lint":{}}}', dir);

    expect(
      Object.keys((JSON.parse(out) as { targets: object }).targets),
    ).toEqual(['lint', 'test']);
  });

  it('refuses a project.json it cannot add the target to', () => {
    expect(() => withTestTarget('{\n  "name": "x"\n}', dir)).toThrow(
      'could not add the test target',
    );
  });
});

describe('withBarrelExport', () => {
  it('appends the export once', () => {
    const once = withBarrelExport("export * from './a';\n", './b');

    expect(once).toBe("export * from './a';\nexport * from './b';\n");
    expect(withBarrelExport(once, './b')).toBe(once);
  });

  it('starts from an empty barrel', () => {
    expect(withBarrelExport('export {};\n', './a')).toBe(
      "export * from './a';\n",
    );
    expect(withBarrelExport(undefined, './a')).toBe("export * from './a';\n");
  });
});

describe('readNgLib', () => {
  const read = (project: string) =>
    runFactoryForTest(
      async () => {
        const lib = await readNgLib(writeBuffer(), 'libs/web/x/ui');
        throw new Error(JSON.stringify({ ...lib, project: undefined }));
      },
      {} as never,
      { seed: { 'libs/web/x/ui/project.json': project } },
    );

  it('reads the name, prefix and layer of an Angular lib', async () => {
    const { error } = await read(
      '{"name":"web-x-ui","prefix":"x","tags":["scope:web","type:ui"]}',
    );

    expect(String(error)).toContain(
      '{"dir":"libs/web/x/ui","name":"web-x-ui","prefix":"x","type":"ui"}',
    );
  });

  it('refuses a lib with no selector prefix', async () => {
    expect(String((await read('{"name":"web-x-domain"}')).error)).toContain(
      'not an Angular lib',
    );
  });
});
