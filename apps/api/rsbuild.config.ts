import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: { index: './src/main.ts' },
    tsconfigPath: './tsconfig.app.json',
    decorators: { version: 'legacy' },
  },
  output: {
    target: 'node',
    distPath: { root: 'dist' },
    // Keep node_modules external: Nest lazy-requires optional peer deps that must not be bundled.
    externals: [/^(?!\.|\/|@anvil\/)/],
  },
});
