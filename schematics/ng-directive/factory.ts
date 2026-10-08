import type { Input } from './schema.generated.ts';
import { create } from '@pbuilder/sdk/commons';
import { assertDashed, pascal } from '../_shared/lib.ts';
import { readNgLib, registerInLib } from '../_shared/ng.ts';

export default async (input: Input) => {
  const name = assertDashed(input.name, 'name');
  const lib = await readNgLib(input.lib.replace(/\/+$/, ''));
  if (lib.type !== 'ui')
    throw new Error(
      `${lib.name} is a ${lib.type || 'untyped'} lib: directives live in ui libs`,
    );
  const selector = `${lib.prefix}${pascal(name)}`;
  const cls = `${pascal(lib.prefix)}${pascal(name)}`;
  const folder = input.folder ? assertDashed(input.folder, 'folder') : name;
  const dir = `${lib.dir}/src/lib/${folder}`;

  // Deliberately fail-closed: a directive that exists is never regenerated over.
  create(`${dir}/${name}.ts`, {
    template: `import { Directive } from '@angular/core';

@Directive({ selector: '[${selector}]' })
export class ${cls} {}
`,
    options: {},
  });
  create(`${dir}/${name}.spec.ts`, {
    template: `import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ${cls} } from './${name}';

@Component({
  imports: [${cls}],
  template: \`<div ${selector}></div>\`,
})
class Host {}

describe('${cls}', () => {
  it('applies to its host element', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const host = fixture.debugElement.query(By.directive(${cls}));

    expect(host).not.toBeNull();
  });
});
`,
    options: {},
  });

  await registerInLib(lib, `./lib/${folder}/${name}`);
};
