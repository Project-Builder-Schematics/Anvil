import type { Input } from './schema.generated.ts';
import { find } from '@pbuilder/sdk/commons';
import { astLibrary } from '@pbuilder/sdk/typescript';
import {
  apiAlias,
  apiLibDir,
  assertDashed,
  assertPascal,
  camel,
  commandFields,
  constant,
  createFile,
  dashed,
  errorClass,
  errorCodes,
  errorStatuses,
  parseRoute,
  pascal,
  readRequired,
  resolveSlice,
  row,
  table,
} from '../_shared/lib.ts';
import {
  addModuleEntry,
  sortNamedImports,
  startRun,
  withAst,
  type Run,
} from '../_shared/ts.ts';

const APP_MODULE = 'apps/api/src/app/app.module.ts';

const HTTP: Record<string, string> = {
  GET: 'Get',
  POST: 'Post',
  PATCH: 'Patch',
  PUT: 'Put',
  DELETE: 'Delete',
};

const defaultStatus = (method: string): number =>
  method === 'POST' ? 201 : 200;

interface Operation {
  useCase: string;
  method: string;
  /** Path under the resource, "/" for the resource root. */
  path: string;
  status: number;
  /** Field names of the use case command from its Use cases row; undefined when the model has no row. */
  fields?: string[] | undefined;
}

const pathParams = (path: string): string[] =>
  [...path.matchAll(/:(\w+)/g)].map((m) => m[1] ?? '');

/** The Zod schemas and the handler of one operation. */
const operation = ({ useCase, method, path, status, fields }: Operation) => {
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
    // Express leaves a body-less request's body undefined, and the pipe validates it as is.
    `const ${name}${section} = z.object({})${section === 'Body' && fields?.every((f) => params.includes(f)) ? '.default({})' : ''};`,
  ];
  const route = path === '/' ? [] : [`'${path.replace(/^\//, '')}'`];
  const decorators = [
    { name: HTTP[method] ?? '', arguments: route },
    ...(status === defaultStatus(method)
      ? []
      : [{ name: 'HttpCode', arguments: [String(status)] }]),
  ];
  const spread =
    inputs.length === 1
      ? (inputs[0]?.variable ?? '')
      : `{ ${inputs.map((i) => `...${i.variable}`).join(', ')} }`;
  const nest = [
    HTTP[method] ?? '',
    ...inputs.map((i) => i.decorator),
    ...(status === defaultStatus(method) ? [] : ['HttpCode']),
  ];
  return { name, schemas, inputs, decorators, spread, nest };
};

/** Maps the domain errors the Answers cells cite to their status; an error nothing cites is logged and answers 500. */
const errorFilterSource = (
  slice: string,
  statuses: Map<string, number>,
): string => {
  const error = errorClass(slice);
  const filter = `${error}Filter`;
  return `import { Catch, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ${error}, type ${error}Code } from '../../domain/errors';

const STATUS: Partial<Record<${error}Code, number>> = {
${[...statuses].map(([code, status]) => `  ${code}: ${String(status)},`).join('\n')}
};

@Catch(${error})
export class ${filter} extends BaseExceptionFilter<${error}> {
  private readonly logger = new Logger(${filter}.name);

  override catch(exception: ${error}, host: ArgumentsHost): void {
    const adapter = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
    if (!adapter) {
      super.catch(exception, host);
      return;
    }
    const status = STATUS[exception.code];
    if (status === undefined)
      this.logger.error(
        \`\${exception.code} has no status in the Driving adapters table, answering 500\`,
      );
    const statusCode = status ?? 500;
    adapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode, code: exception.code },
      statusCode,
    );
  }
}
`;
};

/** Makes the status map say what the docs say now: new codes are added, changed ones updated, codes no Answers cell cites any more dropped. */
const refreshStatuses = (
  ast: astLibrary.SourceFile,
  statuses: Map<string, number>,
): void => {
  const map = ast
    .getVariableDeclarationOrThrow('STATUS')
    .getInitializerIfKindOrThrow(astLibrary.SyntaxKind.ObjectLiteralExpression);
  for (const property of map.getProperties()) {
    if (
      astLibrary.Node.isPropertyAssignment(property) &&
      !statuses.has(property.getName())
    )
      property.remove();
  }
  for (const [code, status] of statuses) {
    const property = map.getProperty(code);
    if (property === undefined)
      map.addPropertyAssignment({ name: code, initializer: String(status) });
    else if (astLibrary.Node.isPropertyAssignment(property))
      property.setInitializer(String(status));
  }
};

const importTypes = (
  ast: astLibrary.SourceFile,
  from: string,
  names: string[],
): void => {
  const declaration = ast.getImportDeclarationOrThrow(from);
  const present = declaration.getNamedImports().map((n) => n.getName());
  declaration.addNamedImports(
    names
      .filter((name) => !present.includes(name))
      .map((name) => ({ name, isTypeOnly: true })),
  );
};

export default async (input: Input, shared?: Run) => {
  const run = shared ?? startRun();
  const context = assertDashed(input.context, 'context');
  const slice = assertDashed(input.slice, 'slice');
  const resource = assertDashed(input.resource, 'resource');
  const { code, docs } = await resolveSlice(context, slice);

  const model = await readRequired(
    `${docs}/domain-model.md`,
    'the route is generated from its domain model',
  );
  const candidates = table(model, 'Driving adapters')
    .map(([route = '', useCase = '', answers = '']) => ({
      route: parseRoute(route),
      useCase,
      answers,
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
  if (!documented?.route)
    throw new Error(
      `${input.method} /${resource}${input.path && input.path !== '/' ? input.path : ''} is not in the Driving adapters table of domain-model.md — add the route to the docs first`,
    );
  const { path } = documented.route;
  const useCase = assertPascal(documented.useCase, 'use case');
  const status = Number(
    /\b(2\d\d)\b/.exec(documented.answers)?.[1] ?? defaultStatus(input.method),
  );
  const command = row(model, 'Use cases', useCase)?.[1];
  const op = operation({
    useCase,
    method: input.method,
    path,
    status,
    fields: command === undefined ? undefined : commandFields(command),
  });

  const lib = apiLibDir(context);
  const indexPath = `${lib}/src/index.ts`;
  await readRequired(
    indexPath,
    `create the context first: hex-bounded-context --context=${context}`,
  );
  const token = constant(dashed(useCase));
  run.edit(indexPath, async (file) => {
    const exported = await withAst(file, (ast) =>
      ast
        .getExportDeclarations()
        .some((d) => d.getNamedExports().some((e) => e.getName() === token)),
    );
    if (!exported)
      throw new Error(
        `@${context} does not export ${token} — run hex-use-case --name=${useCase} first`,
      );
  });
  const compositionPath = `${code}/composition.ts`;
  await readRequired(
    compositionPath,
    `create the slice first: hex-slice --context=${context} --slice=${slice}`,
  );
  await readRequired(
    APP_MODULE,
    'the context module is registered in the API AppModule',
  );

  const controllerPath = `${code}/infrastructure/http/${resource}.controller.ts`;
  const className = `${pascal(resource)}Controller`;
  const filter = `${pascal(slice)}ErrorFilter`;
  const filtered = errorCodes(model).length > 0;
  if (filtered) {
    const errors = `${code}/domain/errors.ts`;
    if (
      !new RegExp(`export class ${errorClass(slice)}\\b`).test(
        await readRequired(errors, `create the slice first: hex-slice`),
      )
    )
      throw new Error(
        `${errors} defines no ${errorClass(slice)} class, which the error filter catches — add it next to the codes`,
      );
    const filterPath = `${code}/infrastructure/http/${filter}.ts`;
    const statuses = errorStatuses(model);
    if ((await find(filterPath).read()) === undefined)
      createFile(filterPath, errorFilterSource(slice, statuses));
    else
      run.edit(filterPath, (file) =>
        withAst(file, (ast) => {
          refreshStatuses(ast, statuses);
        }),
      );
  }
  const created = (await find(controllerPath).read()) === undefined;
  if (created)
    createFile(
      controllerPath,
      `@Controller('${resource}')\nexport class ${className} {}\n`,
    );
  const application = `../../application/${useCase}`;
  const routeDecorators = op.decorators.map(
    (d) => `@${d.name}(${d.arguments.join(', ')})`,
  );
  run.edit(controllerPath, async (file) => {
    const seen = await withAst(file, (ast) => {
      const cls = ast.getClass(className);
      if (!cls) throw new Error(`${controllerPath} has no ${className}`);
      return {
        same: cls
          .getMethod(op.name)
          ?.getDecorators()
          .map((d) => d.getText()),
        answered: cls
          .getMethods()
          .some((m) =>
            m.getDecorators().some((d) => d.getText() === routeDecorators[0]),
          ),
        filtered: cls
          .getDecorators()
          .some(
            (d) =>
              d.getName() === 'UseFilters' &&
              d.getArguments().some((a) => a.getText() === filter),
          ),
      };
    });
    // Already generated: a re-run (hex-subdomain after a doc change) leaves the route alone.
    const routed = seen.same?.join('\n') === routeDecorators.join('\n');
    if (!routed && seen.same !== undefined)
      throw new Error(
        `${className} already handles ${useCase} on another route — one controller method per use case`,
      );
    if (!routed && seen.answered)
      throw new Error(
        `${input.method} /${resource}${path === '/' ? '' : path} is already answered by ${className}`,
      );
    const addFilter = filtered && !seen.filtered;
    if (routed && !addFilter) return;
    for (const name of new Set([
      'Controller',
      ...(routed ? [] : ['Inject', ...op.nest]),
      ...(addFilter ? ['UseFilters'] : []),
    ]))
      file.addImport(name, '@nestjs/common');
    if (addFilter) file.addImport(filter, `./${filter}`);
    if (!routed) {
      file.addImport('z', 'zod');
      file.addImport(token, application);
    }
    await withAst(file, (ast) => {
      const cls = ast.getClassOrThrow(className);
      if (addFilter)
        cls.addDecorator({ name: 'UseFilters', arguments: [filter] });
      if (!routed) {
        importTypes(ast, application, [useCase, `${useCase}Result`]);
        ast.insertStatements(
          cls.getChildIndex(),
          `${astLibrary.Node.isImportDeclaration(cls.getPreviousSibling()) ? '\n' : ''}${op.schemas.join('\n')}`,
        );
        (cls.getConstructors()[0] ?? cls.addConstructor()).addParameter({
          name: `${camel(useCase)}UseCase`,
          type: useCase,
          scope: astLibrary.Scope.Private,
          isReadonly: true,
          decorators: [{ name: 'Inject', arguments: [token] }],
        });
        cls.addMethod({
          name: op.name,
          decorators: op.decorators,
          parameters: op.inputs.map((i) => ({
            name: i.variable,
            type: `z.infer<typeof ${i.schema}>`,
            decorators: [
              { name: i.decorator, arguments: [`{ schema: ${i.schema} }`] },
            ],
          })),
          returnType: `Promise<${useCase}Result>`,
          statements: `return this.${op.name}UseCase(${op.spread});`,
        });
      }
      sortNamedImports(ast, '@nestjs/common');
    });
  });

  run.edit(compositionPath, (file) => {
    file.addImport(className, `./infrastructure/http/${resource}.controller`);
    return withAst(file, (ast) => {
      addModuleEntry(ast, 'controllers', className);
    });
  });
  const contextModule = `${pascal(context)}Module`;
  run.edit(APP_MODULE, (file) => {
    file.addImport(contextModule, apiAlias(context));
    return withAst(file, (ast) => {
      addModuleEntry(ast, 'imports', contextModule);
    });
  });
  if (!shared) await run.flush();
};
