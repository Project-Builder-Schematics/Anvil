import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import { assertDashed, pascal } from '../_shared/lib.ts';
import {
  customTypes,
  parseInputs,
  parseOutputs,
  readNgLib,
  registerInLib,
} from '../_shared/ng.ts';

const KIND_OF_TYPE: Record<string, 'container' | 'presentational'> = {
  feature: 'container',
  ui: 'presentational',
};
const MODULE =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$|^\.\.?(?:\/[A-Za-z0-9._-]+)*$/;
const SAMPLE: Record<string, string> = {
  string: "'sample'",
  number: '1',
  boolean: 'true',
};
const sampleOf = (type: string): string | undefined =>
  type.endsWith('[]') ? '[]' : SAMPLE[type];

export default async (input: Input) => {
  const name = assertDashed(input.name, 'name');
  const lib = await readNgLib(input.lib.replace(/\/+$/, ''));
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
  // The module goes into an import line as code, so only a package or a relative path passes.
  if (input.type_import && !MODULE.test(input.type_import)) {
    throw new Error(
      `type_import "${input.type_import}" must be a package or a relative path, e.g. @demo/web-ordering-domain`,
    );
  }

  const cls = pascal(name);
  for (const type of imported) {
    if (type === cls)
      throw new Error(
        `${type} is the component class: rename the type or the component`,
      );
    if (type === 'Component')
      throw new Error(
        'Component is imported from @angular/core: rename the type',
      );
  }
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

  await registerInLib(lib, `./lib/${folder}/${name}`);
};
