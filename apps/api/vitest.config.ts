import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      enabled: true,
      reportsDirectory: '../../coverage/apps/api',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.spec.ts'],
      thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
    },
  },
  // esbuild (Vite's default) cannot emit decorator metadata, which Nest DI needs.
  plugins: [
    swc.vite({
      tsconfigFile: './tsconfig.spec.json',
      module: { type: 'es6' },
      sourceMaps: true,
    }),
  ],
});
