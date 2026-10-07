import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

const contexts = [
  'catalog',
  'inventory',
  'ordering',
  'payments',
  'shipping',
  'notifications',
];
// Directed edges: [from, to] lets `from` import the barrel of `to`. Maintained by the
// schematics from the Context map of docs/<from>/README.md; undeclared edges stay forbidden.
const contextRelations = [
  ['ordering', 'catalog'],
  ['ordering', 'inventory'],
  ['ordering', 'payments'],
  ['shipping', 'ordering'],
  ['notifications', 'ordering'],
  ['notifications', 'shipping'],
];
const layers = [
  'type:feature',
  'type:ui',
  'type:data-access',
  'type:domain',
  'type:kernel',
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vitest.config.*.timestamp*',
      '**/schema.generated.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:api'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web'] },
            ...contexts.map((context) => ({
              sourceTag: `context:${context}`,
              onlyDependOnLibsWithTags: [
                `context:${context}`,
                'context:shared',
                ...contextRelations
                  .filter(([from]) => from === context)
                  .map(([, to]) => `context:${to}`),
              ],
            })),
            {
              sourceTag: 'context:shared',
              onlyDependOnLibsWithTags: ['context:shared'],
            },
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: layers },
            { sourceTag: 'type:feature', onlyDependOnLibsWithTags: layers },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:domain',
                'type:kernel',
              ],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:domain',
                'type:kernel',
              ],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain', 'type:kernel'],
            },
            {
              sourceTag: 'type:kernel',
              onlyDependOnLibsWithTags: ['type:kernel'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/src/{domain,application}/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*'],
              message: 'Frameworks belong in infrastructure.',
            },
            {
              group: ['typeorm', 'pg', 'knex'],
              message: 'Persistence belongs in infrastructure.',
            },
            {
              group: ['**/infrastructure/**'],
              message: 'Inner rings never import infrastructure.',
            },
          ],
        },
      ],
    },
  },
];
