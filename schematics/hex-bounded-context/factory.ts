import type { Input } from './schema.generated.ts';
import { create, find, replaceContent } from '@pbuilder/sdk/commons';
import {
  DOMAIN_MODEL,
  ESLINT_CONFIG,
  TSCONFIG_BASE,
  addLintContext,
  addTsPath,
  apiAlias,
  apiLibDir,
  assertDashed,
  docsDir,
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

const classification = (
  input: Input,
  level: Level,
  assumed: boolean,
): string => `## Classification

| Axis | Value | What it decides |
| --- | --- | --- |
| Subdomain class | ${input.subdomain_class}${assumed ? ' (assumed)' : ''} | design investment |
| Criticality | ${input.criticality}${assumed ? ' (assumed)' : ''} | verification rigor |
| Volatility | ${input.volatility}${assumed ? ' (assumed)' : ''} | how much cleanup is worth |
| Architecture level | ${level} | derived: strict when the class is core or the criticality is high |
${assumed ? `\n${ASSUMED_NOTE}\n` : ''}
Context map: ${input.context_map ? input.context_map.replace(/\.+$/, '') : 'not mapped yet'}.

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

  const tsconfig = await buffer.readRequired(
    TSCONFIG_BASE,
    'the alias is registered in the workspace tsconfig',
  );
  const lint = await buffer.readRequired(
    ESLINT_CONFIG,
    'the context is registered in the lint boundary list',
  );
  const [readme, glossary] = await Promise.all([
    find(`${docs}/README.md`).read(),
    find(`${docs}/glossary.md`).read(),
  ]);

  // Deliberately fail-closed: a context whose lib exists is never regenerated over.
  for (const [path, template] of Object.entries(
    apiLibFiles(context, input.purpose, inline),
  )) {
    create(path, { template, options: {} });
  }
  await buffer.write(
    TSCONFIG_BASE,
    addTsPath(
      tsconfig,
      apiAlias(context),
      `./${apiLibDir(context)}/src/index.ts`,
    ),
  );
  await buffer.write(ESLINT_CONFIG, addLintContext(lint, context));

  if (readme === undefined) {
    create(`${docs}/README.md`, {
      template: `# ${title(context)}

${input.purpose}

${classification(input, level, assumed)}
## Subdomains

One slice of code per row; docs mirror the code, so a context with several subdomains keeps one folder per subdomain.

| Subdomain | Responsibility |
| --- | --- |
${modelDirs.map(({ subdomain, link }) => `| [${subdomain}](${link}) | |`).join('\n')}

## Ubiquitous language

${
  inline
    ? 'See [glossary.md](glossary.md). Every name in `domain/` and every export of the context barrel is a term defined there.'
    : 'See [glossary.md](glossary.md) for the terms two or more subdomains share and the table of contents; each subdomain owns the rest of its vocabulary next to its own `domain-model.md`. Every name in `domain/` and every export of the context barrel is a term defined in exactly one of them.'
}
`,
      options: {},
    });
  } else if (!readme.includes('## Classification')) {
    replaceContent(
      `${docs}/README.md`,
      `${readme.replace(/\n*$/, '\n')}\n${classification(input, level, assumed)}`,
    );
  }

  const linked = inline ? [] : subdomains;
  if (glossary === undefined) {
    create(`${docs}/glossary.md`, {
      template: `# ${title(context)} — glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.${
        inline
          ? ''
          : ` A term used by two or more subdomains lives here; every other term lives in its own subdomain's glossary, linked below.

## Global terms

## Subdomains

${linked.map(glossaryLink).join('\n')}`
      }
`,
      options: {},
    });
  } else if (withGlossaryLinks(glossary, linked) !== glossary) {
    replaceContent(`${docs}/glossary.md`, withGlossaryLinks(glossary, linked));
  }

  const createMissing = async (
    path: string,
    template: string,
  ): Promise<void> => {
    if ((await find(path).read()) === undefined)
      create(path, { template, options: {} });
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
