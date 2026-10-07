import type { Input } from './schema.generated.ts';
import {
  SCOPE,
  addModuleEntry,
  apiLibDir,
  assertDashed,
  assertPascal,
  camel,
  constant,
  dashed,
  parseRoute,
  pascal,
  resolveSlice,
  table,
  withImports,
  withNamedImports,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';

const APP_MODULE = 'apps/api/src/app/app.module.ts';

const HTTP: Record<string, string> = {
  GET: 'Get',
  POST: 'Post',
  PATCH: 'Patch',
  PUT: 'Put',
  DELETE: 'Delete',
};

interface Operation {
  useCase: string;
  method: string;
  /** Path under the resource, "/" for the resource root. */
  path: string;
  status: number;
}

const pathParams = (path: string): string[] =>
  [...path.matchAll(/:(\w+)/g)].map((m) => m[1] ?? '');

/** The Zod schemas and the handler of one operation. */
const operation = ({ useCase, method, path, status }: Operation) => {
  const name = camel(useCase);
  const params = pathParams(path);
  const section = method === 'GET' || method === 'DELETE' ? 'Query' : 'Body';
  const inputs = [
    ...(params.length > 0
      ? [{ decorator: 'Param', variable: 'params', schema: `${name}Params` }]
      : []),
    {
      decorator: section,
      variable: section.toLowerCase(),
      schema: `${name}${section}`,
    },
  ];
  const schemas = [
    ...(params.length > 0
      ? [
          `const ${name}Params = z.object({ ${params.map((p) => `${p}: z.string()`).join(', ')} });`,
        ]
      : []),
    `const ${name}${section} = z.object({});`,
  ];
  const defaultStatus = method === 'POST' ? 201 : 200;
  const route = path === '/' ? '' : `'${path.replace(/^\//, '')}'`;
  const decorators = [
    `  @${HTTP[method] ?? ''}(${route})`,
    ...(status === defaultStatus ? [] : [`  @HttpCode(${String(status)})`]),
  ];
  const spread =
    inputs.length === 1
      ? (inputs[0]?.variable ?? '')
      : `{ ${inputs.map((i) => `...${i.variable}`).join(', ')} }`;
  const handler = `${decorators.join('\n')}
  ${name}(
${inputs.map((i) => `    @${i.decorator}({ schema: ${i.schema} }) ${i.variable}: z.infer<typeof ${i.schema}>,`).join('\n')}
  ): Promise<${useCase}Result> {
    return this.${name}UseCase(${spread});
  }`;
  const nest = [
    'Controller',
    'Inject',
    HTTP[method] ?? '',
    ...inputs.map((i) => i.decorator),
    ...(status === defaultStatus ? [] : ['HttpCode']),
  ];
  return { name, schemas, handler, nest };
};

const injection = (useCase: string): string =>
  `    @Inject(${constant(dashed(useCase))}) private readonly ${camel(useCase)}UseCase: ${useCase},`;

const applicationImport = (useCase: string): string =>
  `import { ${constant(dashed(useCase))}, type ${useCase}, type ${useCase}Result } from '../../application/${useCase}';`;

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const resource = assertDashed(input.resource, 'resource');
  const { code, docs } = await resolveSlice(context, slice, buffer);

  // The doc's Driving adapters row for this method + resource (+ path) decides what the flags may only confirm.
  const model = await buffer.readRequired(
    `${docs}/domain-model.md`,
    'the route is generated from its domain model',
  );
  const candidates = table(model, 'Driving adapters')
    .map((r) => ({
      route: parseRoute(r[0] ?? ''),
      useCase: r[1],
      answers: r[2] ?? '',
    }))
    .filter(
      ({ route }) =>
        route?.method === input.method &&
        route.resource === resource &&
        (!input.path || route.path === input.path),
    );
  if (candidates.length > 1)
    throw new Error(
      `${input.method} /${resource} has ${String(candidates.length)} rows in domain-model.md — pass --path`,
    );
  const documented = candidates[0];
  const pick = (
    flag: string | undefined,
    doc: string | undefined,
    label: string,
    fallback?: string,
  ): string => {
    if (flag && doc && flag !== doc)
      throw new Error(
        `${label} is ${doc} in domain-model.md, not ${flag} — fix the doc or the flag`,
      );
    const value = flag || doc || fallback;
    if (!value)
      throw new Error(
        `no ${label}: pass --${label} or add the route to the Driving adapters table of domain-model.md`,
      );
    return value;
  };
  const path = pick(input.path, documented?.route?.path, 'path', '/');
  const useCase = assertPascal(
    pick(input.use_case, documented?.useCase, 'use_case'),
    'use_case',
  );
  const docStatus = /\b(2\d\d)\b/.exec(documented?.answers ?? '')?.[1];
  const status = Number(
    pick(
      input.status,
      docStatus,
      'status',
      input.method === 'POST' ? '201' : '200',
    ),
  );
  const op = operation({ useCase, method: input.method, path, status });

  const lib = apiLibDir(context);
  const index = await buffer.readRequired(
    `${lib}/src/index.ts`,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const token = constant(dashed(useCase));
  if (!new RegExp(`export \\{[^}]*\\b${token}\\b[^}]*\\} from`).test(index)) {
    throw new Error(
      `@${context} does not export ${token} — run hex-use-case --name=${useCase} first`,
    );
  }
  const compositionPath = `${code}/composition.ts`;
  const composition = await buffer.readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${slice}`,
  );
  const app = await buffer.readRequired(
    APP_MODULE,
    'the context module is registered in the API AppModule',
  );

  const controllerPath = `${code}/infrastructure/http/${resource}.controller.ts`;
  const controller = await buffer.read(controllerPath);
  // Already generated: a re-run (hex-subdomain after a doc change) leaves it alone.
  if (controller?.includes(`  ${op.name}(`)) return;

  const className = `${pascal(resource)}Controller`;
  if (controller === undefined) {
    await buffer.write(
      controllerPath,
      `${withNamedImports(withImports(`import { z } from 'zod';\n`, [applicationImport(useCase)]), '@nestjs/common', op.nest)}
${op.schemas.join('\n')}

@Controller('${resource}')
export class ${className} {
  constructor(
${injection(useCase)}
  ) {}

${op.handler}
}
`,
    );
  } else {
    const withSchemas = controller.replace(
      /\n@Controller\(/,
      `\n${op.schemas.join('\n')}\n\n@Controller(`,
    );
    const withInjection = withSchemas.replace(
      /\n {2}\) \{\}/,
      `\n${injection(useCase)}\n  ) {}`,
    );
    const withHandler = withInjection.replace(/\}\n$/, `\n${op.handler}\n}\n`);
    await buffer.write(
      controllerPath,
      withNamedImports(
        withImports(withHandler, [applicationImport(useCase)]),
        '@nestjs/common',
        op.nest,
      ),
    );
  }

  await buffer.write(
    compositionPath,
    addModuleEntry(
      withImports(composition, [
        `import { ${className} } from './infrastructure/http/${resource}.controller';`,
      ]),
      'controllers',
      className,
    ),
  );
  const contextModule = `${pascal(context)}Module`;
  await buffer.write(
    APP_MODULE,
    addModuleEntry(
      withImports(app, [
        `import { ${contextModule} } from '${SCOPE}/api-${context}';`,
      ]),
      'imports',
      contextModule,
    ),
  );
  if (!shared) buffer.flush();
};
