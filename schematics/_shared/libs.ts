// The files of a new Nx lib, written to match what the repo already has so that
// every lib looks the same whoever made it. Pure: no engine calls.

import { apiLibDir, pascal } from './lib.ts';

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

/** The lib for one bounded context of the API: `libs/api/<context>`, alias `@demo/api-<context>`. */
export const apiLibFiles = (
  context: string,
  purpose: string,
): Record<string, string> => {
  const dir = apiLibDir(context);
  const files: Record<string, string> = {
    'project.json': `{
  "name": "api-${context}",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "${dir}/src",
  "projectType": "library",
  "tags": ${tagList(['scope:api', `context:${context}`, 'type:domain'])}
}
`,
    'eslint.config.mjs': `import baseConfig from '../../../eslint.config.mjs';

export default [...baseConfig];
`,
    'tsconfig.json': `{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "experimentalDecorators": true
  },
${SOLUTION_REFERENCES}
}
`,
    'tsconfig.lib.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": [
${EXCLUDE_TESTS(['src/**/steps/*.ts'])}
  ]
}
`,
    'tsconfig.spec.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
${NODE_SPEC_TYPES}
  },
  "include": [
${SPEC_INCLUDE(['src/**/steps/*.ts'])}
  ]
}
`,
    'vitest.config.mts': `import { defineConfig } from 'vitest/config';
import { quickpickle } from 'quickpickle';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/${dir}',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']), quickpickle()],
  test: {
    name: 'api-${context}',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: [
      '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '../../../docs/${context}/**/*.feature',
    ],
    setupFiles: ['./src/steps/index.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/${dir}',
      provider: 'v8' as const,
      enabled: true,
      // Adapters, controllers and wiring hold no domain logic; the gate is on the inner rings.
      include: ['src/**/{domain,application}/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
}));
`,
    'COD100.md': `${purpose}\n`,
    'src/composition.ts': `import { Module } from '@nestjs/common';

@Module({})
export class ${pascal(context)}Module {}
`,
    'src/index.ts': `export { ${pascal(context)}Module } from './composition';\n`,
    'src/steps/index.ts': `// quickpickle reads step definitions from setupFiles; this loads every *.steps.ts of the lib.
import.meta.glob(['./*.steps.ts', '../*/steps/*.steps.ts'], { eager: true });
`,
  };
  return Object.fromEntries(
    Object.entries(files).map(([path, content]) => [`${dir}/${path}`, content]),
  );
};

export type WebLayer = 'ui' | 'feature' | 'data-access' | 'domain';

export interface WebLib {
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
  "prefix": "${prefix ?? ''}",
  "projectType": "library",
  "tags": ${tagList(tags)}
}
`,
          'eslint.config.mjs': angularEslint(prefix ?? ''),
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
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.tsx",
    "src/**/*.spec.tsx",
    "src/**/*.test.js",
    "src/**/*.spec.js",
    "src/**/*.test.jsx",
    "src/**/*.spec.jsx",
    "src/test-setup.ts"
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
