import type { Input } from './schema.generated.ts';
import { scaffold } from '@pbuilder/sdk/commons';
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
  scaffold({
    from: 'files/directive',
    to: dir,
    options: { selector, cls, name },
  });

  await registerInLib(lib, `./lib/${folder}/${name}`);
};
