import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import { assertDashed, writeBuffer, type WriteBuffer } from '../_shared/lib.ts';
import {
  className,
  readNgLib,
  withBarrelExport,
  withTestTarget,
} from '../_shared/ng.ts';

const INITIAL = { string: "''", number: '0', boolean: 'false' } as const;

const parseFields = (
  spec: string,
): Array<{ name: string; type: string; initial: string; list: boolean }> =>
  spec
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name = '', raw = ''] = part.split(':').map((s) => s.trim());
      const list = raw.endsWith('[]');
      const base = list ? raw.slice(0, -2) : raw;
      if (!/^[a-z][A-Za-z0-9]*$/.test(name))
        throw new Error(`field "${name}" must be camelCase`);
      if (base !== 'string' && base !== 'number' && base !== 'boolean') {
        throw new Error(
          `field ${name} has type "${raw}": use string, number or boolean, optionally followed by []`,
        );
      }
      return { name, type: raw, initial: list ? '[]' : INITIAL[base], list };
    });

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const name = assertDashed(input.name, 'name');
  const lib = await readNgLib(buffer, input.lib.replace(/\/+$/, ''));
  const fields = parseFields(input.fields ?? '');
  const cls = className(name);
  const folder = input.folder ? assertDashed(input.folder, 'folder') : name;
  const dir = `${lib.dir}/src/lib/${folder}`;

  // Deliberately fail-closed: a service that exists is never regenerated over.
  create(`${dir}/${name}.ts`, {
    template: `import { Injectable${fields.length > 0 ? ', signal' : ''} } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ${cls} ${
      fields.length > 0
        ? `{\n${fields
            .map(
              (f) =>
                `  private readonly _${f.name} = signal<${f.type}>(${f.initial});\n  readonly ${f.name} = this._${f.name}.asReadonly();`,
            )
            .join('\n')}\n}`
        : '{}'
    }
`,
    options: {},
  });
  create(`${dir}/${name}.spec.ts`, {
    template: `import { TestBed } from '@angular/core/testing';
import { ${cls} } from './${name}';

describe('${cls}', () => {
  it('starts with its initial state', () => {
    const service = TestBed.inject(${cls});

${fields.length > 0 ? fields.map((f) => `    expect(service.${f.name}()).${f.list ? 'toEqual' : 'toBe'}(${f.initial});`).join('\n') : '    expect(service).toBeInstanceOf(' + cls + ');'}
  });
});
`,
    options: {},
  });

  const barrelPath = `${lib.dir}/src/index.ts`;
  await buffer.write(
    barrelPath,
    withBarrelExport(await buffer.read(barrelPath), `./lib/${folder}/${name}`),
  );
  await buffer.write(
    `${lib.dir}/project.json`,
    withTestTarget(lib.project, lib.dir),
  );
  if (!shared) buffer.flush();
};
