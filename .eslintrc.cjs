/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { es2022: true, browser: true, node: true },
  // `apps/` holds the vendored demo apps. They are React/Vite projects with their own
  // ESLint config + plugins (installed only in their own node_modules) and they lint
  // themselves in CI (job "apps"). The foundation's root lint must not descend into them,
  // or it fails trying to load a plugin it doesn't have.
  ignorePatterns: ['dist/', 'node_modules/', 'apps/'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  overrides: [
    {
      // Type-aware linting for the foundation's OWN source + tests only.
      // We deliberately enable the three specific type-aware rules the gate wants
      // rather than `plugin:@typescript-eslint/recommended-type-checked`, whose
      // bundled `require-await` false-positives on the test suite's async-generator
      // mocks (async function* that yield a fixed array to satisfy an AsyncIterable
      // interface contract, with no internal await — a legitimate, intentional shape).
      files: ['src/**/*.ts', 'test/**/*.ts'],
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
