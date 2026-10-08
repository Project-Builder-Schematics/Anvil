// The files of a new Nx lib, written to match what the repo already has so that
// every lib looks the same whoever made it. Pure: no engine calls.

const tagList = (tags: string[]): string =>
  `[${tags.map((tag) => `"${tag}"`).join(', ')}]`;

const EXCLUDE_TESTS = (extra: string[]): string =>
  [
    ...extra,
    'vite.config.ts',
    'vite.config.mts',
    'vitest.config.ts',
    'vitest.config.mts',
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/*.test.tsx',
    'src/**/*.spec.tsx',
    'src/**/*.test.js',
    'src/**/*.spec.js',
    'src/**/*.test.jsx',
    'src/**/*.spec.jsx',
  ]
    .map((pattern) => `    "${pattern}"`)
    .join(',\n');

const SPEC_INCLUDE = (extra: string[]): string =>
  [
    'vite.config.ts',
    'vite.config.mts',
    'vitest.config.ts',
    'vitest.config.mts',
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/*.test.tsx',
    'src/**/*.spec.tsx',
    'src/**/*.test.js',
    'src/**/*.spec.js',
    'src/**/*.test.jsx',
    'src/**/*.spec.jsx',
    ...extra,
    'src/**/*.d.ts',
  ]
    .map((pattern) => `    "${pattern}"`)
    .join(',\n');

const SOLUTION_REFERENCES = `  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]`;

const NODE_SPEC_TYPES = `    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node",
      "vitest"
    ]`;

export type WebLayer = 'ui' | 'feature' | 'data-access' | 'domain';

interface WebLib {
  /** Repo-relative lib directory, four levels deep: libs/web/<group>/<name>. */
  dir: string;
  /** Nx project name. */
  name: string;
  /** Selector prefix of Angular libs; domain libs have none. */
  prefix?: string;
  tags: string[];
  layer: WebLayer;
}

const ANGULAR_TSCONFIG = `{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "module": "preserve",
    "lib": ["es2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  },
${SOLUTION_REFERENCES}
}
`;

const angularEslint = (
  prefix: string,
): string => `import nx from '@nx/eslint-plugin';
import baseConfig from '../../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: '${prefix}',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: '${prefix}',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
`;

/** A web lib of one DDD layer. Angular layers share one shape; the domain layer is plain TypeScript. */
export const webLibFiles = ({
  dir,
  name,
  prefix,
  tags,
  layer,
}: WebLib): Record<string, string> => {
  if (layer !== 'domain' && !prefix)
    throw new Error(`${dir} is an Angular lib and needs a selector prefix`);
  const selector = prefix ?? '';
  const root = `${dir}/src`;
  const header = `  "name": "${name}",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "${root}",`;
  const files: Record<string, string> =
    layer === 'domain'
      ? {
          'project.json': `{
${header}
  "projectType": "library",
  "tags": ${tagList(tags)}
}
`,
          'eslint.config.mjs': `import baseConfig from '../../../../eslint.config.mjs';

export default [...baseConfig];
`,
          'tsconfig.json': `{
  "extends": "../../../../tsconfig.base.json",
${SOLUTION_REFERENCES}
}
`,
          'tsconfig.lib.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": [
${EXCLUDE_TESTS([])}
  ]
}
`,
          'tsconfig.spec.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
${NODE_SPEC_TYPES}
  },
  "include": [
${SPEC_INCLUDE([])}
  ]
}
`,
          'vitest.config.mts': `import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../../node_modules/.vite/${dir}',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: '${name}',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../../coverage/${dir}',
      provider: 'v8' as const,
    },
  },
}));
`,
          'src/index.ts': 'export {};\n',
        }
      : {
          'project.json': `{
${header}
  "prefix": "${selector}",
  "projectType": "library",
  "tags": ${tagList(tags)}
}
`,
          'eslint.config.mjs': angularEslint(selector),
          'tsconfig.json': ANGULAR_TSCONFIG,
          'tsconfig.lib.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": [
${EXCLUDE_TESTS(['src/test-setup.ts'])}
  ]
}
`,
          'tsconfig.spec.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}
`,
          'src/index.ts': 'export {};\n',
        };
  return Object.fromEntries(
    Object.entries(files).map(([path, content]) => [`${dir}/${path}`, content]),
  );
};
