import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import { assertDashed, writeBuffer, type WriteBuffer } from '../_shared/lib.ts';
import {
  className,
  customTypes,
  parseInputs,
  parseOutputs,
  readNgLib,
  withBarrelExport,
  withTestTarget,
} from '../_shared/ng.ts';

const KIND_OF_TYPE: Record<string, 'container' | 'presentational'> = {
  feature: 'container',
  ui: 'presentational',
};
const SAMPLE: Record<string, string> = {
  string: "'sample'",
  number: '1',
  boolean: 'true',
};
const sampleOf = (type: string): string | undefined =>
  type.endsWith('[]') ? '[]' : SAMPLE[type];

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const name = assertDashed(input.name, 'name');
  const lib = await readNgLib(buffer, input.lib.replace(/\/+$/, ''));
  const derived = KIND_OF_TYPE[lib.type];
  if (!derived)
    throw new Error(
      `${lib.name} is a ${lib.type || 'untyped'} lib, not an Angular lib that holds components (ui or feature)`,
    );
  if (input.kind && input.kind !== derived) {
    throw new Error(
      `${lib.name} is a ${lib.type} lib, so its components are ${derived}, not ${input.kind} — fix the flag or pick another lib`,
    );
  }
  const inputs = parseInputs(input.inputs ?? '');
  const outputs = parseOutputs(input.outputs ?? '');
  const both = inputs.find((i) => outputs.some((o) => o.name === i.name));
  if (both) throw new Error(`${both.name} is both an input and an output`);
  if (derived === 'container' && (inputs.length > 0 || outputs.length > 0)) {
    throw new Error(
      'a container takes no inputs or outputs: it gets its data from data-access',
    );
  }

  const imported = customTypes([
    ...inputs.map((i) => i.type),
    ...outputs.flatMap((o) => (o.type ? [o.type] : [])),
  ]);
  if (imported.length > 0 && !input.type_import) {
    throw new Error(
      `${imported.join(', ')} must be imported from a module: pass type_import`,
    );
  }

  const cls = className(name);
  const folder = input.folder ? assertDashed(input.folder, 'folder') : name;
  const dir = `${lib.dir}/src/lib/${folder}`;
  const angular = [
    'Component',
    ...(inputs.length > 0 ? ['input'] : []),
    ...(outputs.length > 0 ? ['output'] : []),
  ];
  const members = [
    ...inputs.map((i) => `  readonly ${i.name} = input.required<${i.type}>();`),
    ...outputs.map(
      (o) => `  readonly ${o.name} = output${o.type ? `<${o.type}>` : ''}();`,
    ),
  ];

  // Deliberately fail-closed: a component that exists is never regenerated over.
  create(`${dir}/${name}.ts`, {
    template: `import { ${angular.join(', ')} } from '@angular/core';
${imported.length > 0 ? `import type { ${imported.join(', ')} } from '${input.type_import}';\n` : ''}
@Component({
  selector: '${lib.prefix}-${name}',
  templateUrl: './${name}.html',
  styleUrl: './${name}.css',
})
export class ${cls} ${members.length > 0 ? `{\n${members.join('\n')}\n}` : '{}'}
`,
    options: {},
  });
  create(`${dir}/${name}.html`, { template: '<ng-content />\n', options: {} });
  create(`${dir}/${name}.css`, {
    template: ':host {\n  display: block;\n}\n',
    options: {},
  });
  create(`${dir}/${name}.spec.ts`, {
    template: `import { TestBed } from '@angular/core/testing';
import { ${cls} } from './${name}';

describe('${cls}', () => {
  it('renders', async () => {
    const fixture = TestBed.createComponent(${cls});
${inputs
  .flatMap((i) => {
    const sample = sampleOf(i.type);
    return sample === undefined
      ? []
      : [`    fixture.componentRef.setInput('${i.name}', ${sample});\n`];
  })
  .join('')}    await fixture.whenStable();

    expect(fixture.nativeElement as HTMLElement).toBeInstanceOf(HTMLElement);
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
