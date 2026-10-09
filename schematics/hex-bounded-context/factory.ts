import type { Input } from './schema.generated.ts';
import { create, find, scaffold } from '@pbuilder/sdk/commons';
import {
  DOMAIN_MODEL,
  ESLINT_CONFIG,
  RELATIONSHIPS,
  TSCONFIG_BASE,
  addTsPath,
  apiAlias,
  apiLibDir,
  assertDashed,
  docsDir,
  pascal,
  readRequired,
  rewrite,
  table,
  title,
} from '../_shared/lib.ts';
import {
  addContextRelation,
  addLintContext,
  startRun,
  withAst,
} from '../_shared/ts.ts';

type Level = 'strict' | 'standard';

const LEVEL_TEXT: Record<Level, string> = {
  strict:
    "Use cases receive their driven ports (`make<UseCase>(ports)`) and are wired in the slice's `composition.ts` with `useFactory`/`inject`. " +
    '`application/` and `domain/` import no infrastructure and no framework. Rules are pure functions, tested without a database.',
  standard:
    'Use cases may import their adapters directly; driven ports are optional. ' +
    'Promote a slice to strict when it starts to handle money, access or an external system.',
};

const ASSUMED_NOTE =
  'The classification is an assumption until the person confirms it; the strict level applies meanwhile.';

const parseContextMap = (
  text: string,
  context: string,
): [provider: string, relationship: string][] => {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [provider, relationship, ...rest] = entry
        .split(':')
        .map((part) => part.trim());
      if (!provider || !relationship || rest.length > 0)
        throw new Error(
          `context_map entry "${entry}" must be <context>:<relationship>`,
        );
      assertDashed(provider, 'context_map context');
      if (provider === context)
        throw new Error(`${context} cannot depend on itself`);
      if (seen.has(provider))
        throw new Error(`${provider} is listed twice in context_map`);
      seen.add(provider);
      if (!RELATIONSHIPS.includes(relationship))
        throw new Error(
          `relationship "${relationship}" must be one of ${RELATIONSHIPS.join(', ')}`,
        );
      return [provider, relationship];
    });
};

const contextMap = (relations: [string, string][]): string => `## Context map

The contexts this one depends on, each through its public barrel only. A dependency not listed here is refused by the schematics and by the lint boundaries. Relationship is ${RELATIONSHIPS.map(
  (r) => `\`${r}\``,
)
  .join(', ')
  .replace(/, ([^,]*)$/, ' or $1')}.

| Depends on | Relationship |
| --- | --- |
${relations.map(([provider, relationship]) => `| ${provider} | ${relationship} |\n`).join('')}`;

const classification = (
  input: Input,
  level: Level,
  assumed: boolean,
  relations: [string, string][],
): string => `## Classification

| Axis | Value | What it decides |
| --- | --- | --- |
| Subdomain class | ${input.subdomain_class}${assumed ? ' (assumed)' : ''} | design investment |
| Criticality | ${input.criticality}${assumed ? ' (assumed)' : ''} | verification rigor |
| Volatility | ${input.volatility}${assumed ? ' (assumed)' : ''} | how much cleanup is worth |
| Architecture level | ${level} | derived: strict when the class is core or the criticality is high |
${assumed ? `\n${ASSUMED_NOTE}\n` : ''}
${contextMap(relations)}
## Architecture level: ${level}

${LEVEL_TEXT[level]}
`;

const glossaryLink = (subdomain: string): string =>
  `- [${subdomain}](${subdomain}/glossary.md)`;

/** Appends the missing subdomain links to the context glossary's table of contents, the last thing in it. */
const withGlossaryLinks = (glossary: string, subdomains: string[]): string => {
  const missing = subdomains
    .filter((subdomain) => !glossary.includes(`(${subdomain}/glossary.md)`))
    .map(glossaryLink);
  if (missing.length === 0) return glossary;
  const body = glossary.replace(/\n*$/, '\n');
  return `${body}${/^## Subdomains\s*$/m.test(body) ? '' : '\n## Subdomains\n\n'}${missing.join('\n')}\n`;
};

/** The engine decodes a text option that holds a JSON list or object, and prints `map[]` for `{}`. */
const readsAsJsonContainer = (text: string): boolean => {
  try {
    return typeof JSON.parse(text) === 'object';
  } catch {
    return false;
  }
};

export default async (input: Input) => {
  const run = startRun();
  const context = assertDashed(input.context, 'context');
  if (readsAsJsonContainer(input.purpose))
    throw new Error(
      `purpose "${input.purpose}" reads as JSON, which the engine decodes before it prints — write a sentence`,
    );
  const docs = docsDir(context);
  const assumed = input.classification_status === 'assumed';
  const level: Level =
    assumed || input.subdomain_class === 'core' || input.criticality === 'high'
      ? 'strict'
      : 'standard';
  const relations = parseContextMap(input.context_map ?? '', context);
  const subdomains = (input.subdomains ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => assertDashed(s, 'subdomain'));
  const inline = subdomains.length <= 1;
  const modelDirs = (inline ? [subdomains[0] ?? context] : subdomains).map(
    (subdomain) => ({
      subdomain,
      dir: inline ? docs : `${docs}/${subdomain}`,
      link: inline ? DOMAIN_MODEL : `${subdomain}/${DOMAIN_MODEL}`,
    }),
  );

  const [readme, glossary] = await Promise.all([
    find(`${docs}/README.md`).read(),
    find(`${docs}/glossary.md`).read(),
  ]);
  // A README that already declares its map is the contract: the lint edges follow it.
  const documented =
    readme?.includes('## Classification') === true
      ? table(readme, 'Context map').map((r) => r[0] ?? '')
      : undefined;
  for (const [provider] of relations) {
    if (documented && !documented.includes(provider))
      throw new Error(
        `${provider} is not in the Context map of ${docs}/README.md — declare the relation there first`,
      );
  }
  const providers = [
    ...new Set([
      ...relations.map(([provider]) => provider),
      ...(documented ?? []),
    ]),
  ];

  const tsconfig = await readRequired(
    TSCONFIG_BASE,
    'the alias is registered in the workspace tsconfig',
  );
  for (const provider of providers) {
    if (!tsconfig.includes(`"${apiAlias(provider)}":`))
      throw new Error(
        `${provider} is not a registered context — create it first`,
      );
  }
  await readRequired(
    ESLINT_CONFIG,
    'the context is registered in the lint boundary list',
  );

  // Deliberately fail-closed: a context whose lib exists is never regenerated over.
  const lib = apiLibDir(context);
  scaffold({
    from: 'files/lib',
    to: lib,
    options: {
      context,
      dir: lib,
      purpose: input.purpose,
      module: `${pascal(context)}Module`,
    },
  });
  if (inline) scaffold({ from: 'files/rings', to: lib, options: {} });
  rewrite(
    TSCONFIG_BASE,
    tsconfig,
    addTsPath(
      tsconfig,
      apiAlias(context),
      `./${apiLibDir(context)}/src/index.ts`,
    ),
  );
  run.edit(ESLINT_CONFIG, (file) =>
    withAst(file, (ast) => {
      addLintContext(ast, context);
      for (const provider of providers)
        addContextRelation(ast, context, provider);
    }),
  );

  const subdomainsSection = `## Subdomains

One slice of code per row; docs mirror the code, so a context with several subdomains keeps one folder per subdomain.

| Subdomain | Responsibility |
| --- | --- |
${modelDirs.map(({ subdomain, link }) => `| [${subdomain}](${link}) | |`).join('\n')}
`;
  if (readme === undefined) {
    create(`${docs}/README.md`, {
      templateFile: 'files/docs/README.md.template',
      options: {
        title: title(context),
        purpose: input.purpose,
        classification: classification(input, level, assumed, relations),
        subdomains: subdomainsSection,
        language: inline
          ? 'See [glossary.md](glossary.md). Every name in `domain/` and every export of the context barrel is a term defined there.'
          : 'See [glossary.md](glossary.md) for the terms two or more subdomains share and the table of contents; each subdomain owns the rest of its vocabulary next to its own `domain-model.md`. Every name in `domain/` and every export of the context barrel is a term defined in exactly one of them.',
      },
    });
  } else {
    const missing = [
      readme.includes('## Classification')
        ? ''
        : classification(input, level, assumed, relations),
      /^## Subdomains\s*$/m.test(readme) ? '' : subdomainsSection,
    ].filter(Boolean);
    if (missing.length > 0)
      rewrite(
        `${docs}/README.md`,
        readme,
        `${readme.replace(/\n*$/, '\n')}\n${missing.join('\n')}`,
      );
  }

  const linked = inline ? [] : subdomains;
  if (glossary === undefined) {
    create(`${docs}/glossary.md`, {
      templateFile: inline
        ? 'files/docs/glossary.md.template'
        : 'files/docs/glossary-nested.md.template',
      options: {
        title: title(context),
        links: linked.map(glossaryLink).join('\n'),
      },
    });
  } else {
    rewrite(
      `${docs}/glossary.md`,
      glossary,
      withGlossaryLinks(glossary, linked),
    );
  }

  const createMissing = async (
    path: string,
    templateFile: string,
    options: Record<string, string>,
  ): Promise<void> => {
    if ((await find(path).read()) === undefined)
      create(path, { templateFile: `files/docs/${templateFile}`, options });
  };
  await Promise.all(
    modelDirs.flatMap(({ subdomain, dir }) => [
      createMissing(`${dir}/${DOMAIN_MODEL}`, 'domain-model.md.template', {
        title: title(subdomain),
        intro: inline
          ? `The single subdomain of [${title(context)}](README.md). Terms are in the [glossary](glossary.md)`
          : `Subdomain of [${title(context)}](../README.md). Terms are in the [glossary](glossary.md), or the [context root's](../glossary.md) for a term shared with another subdomain`,
      }),
      createMissing(`${dir}/flows.md`, 'flows.md.template', {
        title: title(subdomain),
        subdomain,
      }),
      ...(inline
        ? []
        : [
            createMissing(
              `${dir}/glossary.md`,
              'subdomain-glossary.md.template',
              {
                title: title(context),
                subdomain,
              },
            ),
          ]),
    ]),
  );
  await run.flush();
};
