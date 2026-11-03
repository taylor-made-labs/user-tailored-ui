import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web app surface (React 18 + Vite). The deterministic test suite runs under
// vitest with the node environment; the browser build is produced by `vite build`.
export default defineConfig({
  plugins: [react()],
});
