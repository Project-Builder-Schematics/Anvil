import type { Input } from './schema.generated.ts';
import { find, replaceContent } from '@pbuilder/sdk/commons';
import {
  DOMAIN_MODEL,
  ESLINT_CONFIG,
  RELATIONSHIPS,
  TSCONFIG_BASE,
  addContextRelation,
  addLintContext,
  addTsPath,
  apiAlias,
  apiLibDir,
  assertDashed,
  createFile,
  docsDir,
  table,
  title,
  writeBuffer,
  type WriteBuffer,
} from '../_shared/lib.ts';
import { apiLibFiles } from '../_shared/libs.ts';

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

const DEFERRED_AGGREGATES =
  '\nNot applicable: the tactical model is deliberately deferred; the rules run as procedures over the rows (Transaction Script). Why: TODO: why. Follow-up: TODO: follow-up ticket and its trigger (a rule spanning rows, an invariant living in storage, a move to core or high criticality).\n';

const domainModel = (
  context: string,
  subdomain: string,
  inline: boolean,
  deferred: boolean,
): string => `# ${title(subdomain)} — domain model

${
  inline
    ? `The single subdomain of [${title(context)}](README.md). Terms are in the [glossary](glossary.md)`
    : `Subdomain of [${title(context)}](../README.md). Terms are in the [glossary](glossary.md), or the [context root's](../glossary.md) for a term shared with another subdomain`
}; sequence diagrams are in [flows.md](flows.md). Each business rule becomes a \`Rule:\` in a feature next to this file.

## Aggregates

| Aggregate | Root entity | Invariants it protects | Changed by |
| --- | --- | --- | --- |
${deferred ? DEFERRED_AGGREGATES : ''}
## Entities

| Entity | Identity | Attributes | Inside aggregate | Lifecycle |
| --- | --- | --- | --- | --- |

## Value objects

| Value object | Attributes | Validation | Used by |
| --- | --- | --- | --- |

## Business rules

Numbered; every validation cites one; state precedence when several can hold; \`<\` vs \`<=\` spelled. \`Source\` is \`decided[ — <reason>]\` or \`assumed\`, and an \`assumed\` rule may only back a \`@draft\` feature. Error codes are CAPS tokens in backticks.

| # | Rule | Source |
| --- | --- | --- |

## Use cases

One row per use case; \`Feature\` links the \`.feature\` written next to this file before the code is generated.

| Use case | Command | Result | Driven ports | Feature |
| --- | --- | --- | --- | --- |

## Driven ports

\`Adapter today\` starts with \`Memory\` or \`@<context>\` (another context's barrel). \`Contract\` is the invariant every implementation keeps, in-memory or real.

| Port | Answers | Adapter today | Contract |
| --- | --- | --- | --- |

## Driving adapters

\`Route\` is \`METHOD /<resource>[/path]\` under the API's global prefix. \`Answers\` lists the statuses; the first 2xx is the success status. \`Caller\` is who may call and where the identity comes from; request bodies never carry \`userId\`, \`accountId\` or \`actorId\`.

| Route | Use case | Answers | Caller |
| --- | --- | --- | --- |
`;

const flows = (subdomain: string): string => `# ${title(subdomain)} — flows

Sequence diagrams for [${subdomain}](${DOMAIN_MODEL}). Rule numbers refer to its Business rules. One Mermaid \`sequenceDiagram\` per use case whose request crosses more than one component: controller, use case, driven ports, and whatever happens after the response.
`;

const subdomainGlossary = (
  context: string,
  subdomain: string,
): string => `# ${title(context)} / ${subdomain} — glossary

Terms of the ${subdomain} subdomain. A term shared by two or more subdomains lives in the [context glossary](../glossary.md) instead.
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

export default async (input: Input, shared?: WriteBuffer) => {
  const buffer = shared ?? writeBuffer();
  const context = assertDashed(input.context, 'context');
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

  const tsconfig = await buffer.readRequired(
    TSCONFIG_BASE,
    'the alias is registered in the workspace tsconfig',
  );
  for (const provider of providers) {
    if (!tsconfig.includes(`"${apiAlias(provider)}":`))
      throw new Error(
        `${provider} is not a registered context — create it first`,
      );
  }
  const lint = await buffer.readRequired(
    ESLINT_CONFIG,
    'the context is registered in the lint boundary list',
  );

  // Deliberately fail-closed: a context whose lib exists is never regenerated over.
  for (const [path, template] of Object.entries(
    apiLibFiles(context, input.purpose, inline),
  )) {
    createFile(path, template);
  }
  await buffer.write(
    TSCONFIG_BASE,
    addTsPath(
      tsconfig,
      apiAlias(context),
      `./${apiLibDir(context)}/src/index.ts`,
    ),
  );
  await buffer.write(
    ESLINT_CONFIG,
    providers.reduce(
      (config, provider) => addContextRelation(config, context, provider),
      addLintContext(lint, context),
    ),
  );

  const subdomainsSection = `## Subdomains

One slice of code per row; docs mirror the code, so a context with several subdomains keeps one folder per subdomain.

| Subdomain | Responsibility |
| --- | --- |
${modelDirs.map(({ subdomain, link }) => `| [${subdomain}](${link}) | |`).join('\n')}
`;
  if (readme === undefined) {
    createFile(
      `${docs}/README.md`,
      `# ${title(context)}

${input.purpose}

${classification(input, level, assumed, relations)}
${subdomainsSection}
## Ubiquitous language

${
  inline
    ? 'See [glossary.md](glossary.md). Every name in `domain/` and every export of the context barrel is a term defined there.'
    : 'See [glossary.md](glossary.md) for the terms two or more subdomains share and the table of contents; each subdomain owns the rest of its vocabulary next to its own `domain-model.md`. Every name in `domain/` and every export of the context barrel is a term defined in exactly one of them.'
}
`,
    );
  } else {
    const missing = [
      readme.includes('## Classification')
        ? ''
        : classification(input, level, assumed, relations),
      /^## Subdomains\s*$/m.test(readme) ? '' : subdomainsSection,
    ].filter(Boolean);
    if (missing.length > 0)
      replaceContent(
        `${docs}/README.md`,
        `${readme.replace(/\n*$/, '\n')}\n${missing.join('\n')}`,
      );
  }

  const linked = inline ? [] : subdomains;
  if (glossary === undefined) {
    createFile(
      `${docs}/glossary.md`,
      `# ${title(context)} — glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.${
        inline
          ? ''
          : ` A term used by two or more subdomains lives here; every other term lives in its own subdomain's glossary, linked below.

## Global terms

## Subdomains

${linked.map(glossaryLink).join('\n')}`
      }
`,
    );
  } else if (withGlossaryLinks(glossary, linked) !== glossary) {
    replaceContent(`${docs}/glossary.md`, withGlossaryLinks(glossary, linked));
  }

  const createMissing = async (
    path: string,
    template: string,
  ): Promise<void> => {
    if ((await find(path).read()) === undefined) createFile(path, template);
  };
  await Promise.all(
    modelDirs.flatMap(({ subdomain, dir }) => [
      createMissing(
        `${dir}/${DOMAIN_MODEL}`,
        domainModel(context, subdomain, inline, input.tactical === 'deferred'),
      ),
      createMissing(`${dir}/flows.md`, flows(subdomain)),
      ...(inline
        ? []
        : [
            createMissing(
              `${dir}/glossary.md`,
              subdomainGlossary(context, subdomain),
            ),
          ]),
    ]),
  );
  if (!shared) buffer.flush();
};
