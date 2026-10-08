import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import { assertDashed, pascal } from '../_shared/lib.ts';
import { readNgLib, registerInLib } from '../_shared/ng.ts';

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

export default async (input: Input) => {
  const name = assertDashed(input.name, 'name');
  const lib = await readNgLib(input.lib.replace(/\/+$/, ''));
  const fields = parseFields(input.fields ?? '');
  const cls = pascal(name);
  const folder = input.folder ? assertDashed(input.folder, 'folder') : name;
  const dir = `${lib.dir}/src/lib/${folder}`;

  // Deliberately fail-closed: a service that exists is never regenerated over.
  create(`${dir}/${name}.ts`, {
    templateFile: 'files/service.ts.template',
    options: {
      imports: fields.length > 0 ? 'Service, signal' : 'Service',
      cls,
      members:
        fields.length > 0
          ? `\n${fields
              .map(
                (f) =>
                  `  private readonly _${f.name} = signal<${f.type}>(${f.initial});\n  readonly ${f.name} = this._${f.name}.asReadonly();`,
              )
              .join('\n')}\n`
          : '',
    },
  });
  create(`${dir}/${name}.spec.ts`, {
    templateFile: 'files/service.spec.ts.template',
    options: {
      cls,
      name,
      expectations:
        fields.length > 0
          ? fields
              .map(
                (f) =>
                  `    expect(service.${f.name}()).${f.list ? 'toEqual' : 'toBe'}(${f.initial});`,
              )
              .join('\n')
          : `    expect(service).toBeInstanceOf(${cls});`,
    },
  });

  await registerInLib(lib, `./lib/${folder}/${name}`);
};
