import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    globals: true,
    passWithNoTests: true,
  },
  // esbuild (Vite's default) cannot emit decorator metadata, which Nest DI needs.
  plugins: [swc.vite({ tsconfigFile: './tsconfig.spec.json', module: { type: 'es6' } })],
});
