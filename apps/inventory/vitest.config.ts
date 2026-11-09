import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Installs fake-indexeddb + a Node-20-safe navigator so the browser-repos-backed
    // history store runs identically local and on CI. Harmless to the other suites.
    setupFiles: ['./test/setup.ts'],
  },
});
