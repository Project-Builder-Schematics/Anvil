import nx from '@nx/eslint-plugin';

const contexts = [
  'catalog',
  'inventory',
  'ordering',
  'payments',
  'shipping',
  'notifications',
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
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
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
