import { defineConfig } from 'vitest/config';
import { quickpickle } from 'quickpickle';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/api/notifications',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']), quickpickle()],
  test: {
    name: 'api-notifications',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: [
      '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '../../../docs/notifications/**/*.feature',
    ],
    setupFiles: ['./src/steps/index.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/api/notifications',
      provider: 'v8' as const,
      enabled: true,
      // Adapters, controllers and wiring hold no domain logic; the gate is on the inner rings.
      include: ['src/**/{domain,application}/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
}));
