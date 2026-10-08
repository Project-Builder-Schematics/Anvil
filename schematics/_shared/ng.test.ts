import { describe, expect, it } from 'bun:test';
import { runFactoryForTest } from '@pbuilder/sdk/testing';
import {
  customTypes,
  parseInputs,
  parseOutputs,
  readNgLib,
  withTestTarget,
} from './ng.ts';

describe('parseInputs', () => {
  it('reads typed camelCase inputs', () => {
    expect(parseInputs('label:string, count:number')).toEqual([
      { name: 'label', type: 'string' },
      { name: 'count', type: 'number' },
    ]);
  });

  it('refuses a name or type the generated specs cannot fill', () => {
    expect(() => parseInputs('Label:string')).toThrow('camelCase');
    expect(() => parseInputs('label:date')).toThrow(
      'string, number, boolean or a PascalCase type',
    );
  });

  it('refuses an input with more than one colon instead of dropping the rest', () => {
    expect(() => parseInputs('label:string:extra')).toThrow(
      'input "label:string:extra" has more than one colon',
    );
  });

  it('refuses the same input twice', () => {
    expect(() => parseInputs('label:string,label:number')).toThrow(
      'label is listed twice',
    );
  });
});

describe('parseInputs with custom types', () => {
  it('reads a PascalCase type and its array', () => {
    expect(parseInputs('order:Order, lines:OrderLine[]')).toEqual([
      { name: 'order', type: 'Order' },
      { name: 'lines', type: 'OrderLine[]' },
    ]);
  });
});

describe('parseOutputs', () => {
  it('reads camelCase names with an optional payload type', () => {
    expect(parseOutputs('selected, added:AddLine, picked:number')).toEqual([
      { name: 'selected' },
      { name: 'added', type: 'AddLine' },
      { name: 'picked', type: 'number' },
    ]);
  });

  it('refuses an output with more than one colon instead of dropping the rest', () => {
    expect(() => parseOutputs('added:AddLine:extra')).toThrow(
      'output "added:AddLine:extra" has more than one colon',
    );
  });

  it('refuses a name in the wrong case, a bad type and a repeated name', () => {
    expect(() => parseOutputs('Selected')).toThrow('camelCase');
    expect(() => parseOutputs('added:add-line')).toThrow('PascalCase type');
    expect(() => parseOutputs('selected,selected')).toThrow(
      'output selected is listed twice',
    );
  });
});

describe('customTypes', () => {
  it('lists the imported types once, sorted, without the array suffix', () => {
    expect(
      customTypes(['string', 'OrderLine[]', 'Order', 'OrderLine', 'number[]']),
    ).toEqual(['Order', 'OrderLine']);
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

describe('readNgLib', () => {
  const read = (project: string) =>
    runFactoryForTest(
      async () => {
        const lib = await readNgLib('libs/web/x/ui');
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
