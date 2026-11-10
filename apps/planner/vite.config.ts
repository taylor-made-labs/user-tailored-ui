import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Web app surface (React 18 + Vite). The deterministic test suite runs under
// vitest with the node environment; the browser build is produced by `vite build`.
// The labeled test double is enabled ONLY for the dev server with
// VITE_ENABLE_TEST_DOUBLE=true. `vite build` always defines it false, so the
// double and its script are removed from the production bundle (R2.4).
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  define: {
    __ENABLE_TEST_DOUBLE__: JSON.stringify(
      command === 'serve' && loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_TEST_DOUBLE === 'true',
    ),
  },
}));
