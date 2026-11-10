import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Variable specifiers: the scripts are plain .mjs without type declarations.
const sensitiveUrl = new URL('../scripts/sensitive-paths.mjs', import.meta.url).href;
const parityUrl = new URL('../scripts/vendored-parity.mjs', import.meta.url).href;
const { isSensitive } = (await import(sensitiveUrl)) as { isSensitive: (p: string) => boolean };
const { checkParity } = (await import(parityUrl)) as { checkParity: (root: string) => string[] };

const held = (files: string[]) => files.filter(isSensitive);

describe('sensitive-path rule: still held', () => {
  it.each([
    'src/domain/customization/validator.ts',
    'src/domain/customization/orchestrator.ts',
    'src/domain/customization/policy.ts',
    '.github/workflows/auto-merge.yml',
    '.github/workflows/e2e.yml',
    'scripts/dep-hygiene.mjs',
    'scripts/boundary-check.mjs',
    'scripts/sensitive-paths.mjs',
    'scripts/vendored-parity.mjs',
    'scripts/agent-fix.mjs',
    'scripts/semantic-review.mjs',
    '.kiro/agents/customization-boundary-reviewer.json',
    'src/broker/handler.ts',
    'LICENSE-MIT',
    'NOTICE',
    '.env',
    '.env.production',
    'apps/planner/.env.local',
    'certs/server.pem',
    'deploy/signing.key',
    'config/secrets.json',
    'config/credentials',
    'infra/secrets/prod.txt',
  ])('%s', (p) => expect(isSensitive(p)).toBe(true));
});

describe('sensitive-path rule: no longer held', () => {
  it.each([
    'src/security/secret-string.ts',
    'apps/planner/src/foundation/domain/customization/validator.ts',
    'apps/inventory/src/foundation/security/secret-string.ts',
    'apps/planner/src/customization/policy.ts',
    '.env.example',
    'scripts/vendor-apps.sh',
    'package.json',
  ])('%s', (p) => expect(isSensitive(p)).toBe(false));
});

// File lists captured from the open PRs (gh pr diff --name-only), vendored copies abbreviated.
describe('open PRs', () => {
  const prs: Record<string, string[]> = {
    '#18': ['package.json', 'src/adapters/keys/key-store.ts', 'src/security/secret-string.ts'],
    '#19': [
      'apps/planner/creator-policy.json',
      'apps/planner/src/foundation/domain/customization/json-policy.ts',
      'src/domain/customization/json-policy.ts',
    ],
    '#20': ['apps/planner/src/foundation/adapters/history/browser-repos.ts', 'scripts/vendor-apps.sh'],
    '#21': [
      'apps/planner/src/foundation/security/secret-string.ts',
      'apps/inventory/src/foundation/adapters/keys/key-store.ts',
      'scripts/check-no-test-double.mjs',
    ],
    '#22': ['src/broker/handler.ts', 'src/broker/lambda.ts', 'test/broker.test.ts'],
    '#24': ['.github/workflows/e2e.yml', 'e2e/tests/apps.spec.ts'],
    '#26': [
      'apps/planner/src/foundation/domain/customization/validator.ts',
      'src/domain/customization/orchestrator.ts',
      'src/domain/customization/validator.ts',
    ],
  };
  const expected: Record<string, string[]> = {
    '#18': [],
    '#19': [],
    '#20': [],
    '#21': [],
    '#22': ['src/broker/handler.ts', 'src/broker/lambda.ts'],
    '#24': ['.github/workflows/e2e.yml'],
    '#26': ['src/domain/customization/orchestrator.ts', 'src/domain/customization/validator.ts'],
  };
  it.each(Object.keys(prs))('%s held files', (n) => expect(held(prs[n] ?? [])).toEqual(expected[n]));
});

describe('vendored-parity', () => {
  const make = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'parity-'));
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), c);
    }
    return root;
  };
  const f = 'apps/a/src/foundation/x.ts';

  it('accepts a comment-stripped, reformatted copy', () => {
    const root = make({
      'src/x.ts': '/** doc */\nimport { a, b, } from "./m.js";\n// note\nexport const c = a + b;\n',
      [f]: 'import { a, b } from "./m.js";\nexport const c = a + b;\n',
    });
    expect(checkParity(root)).toEqual([]);
  });
  it('rejects a code change', () => {
    const root = make({ 'src/x.ts': 'export const a = 1;\n', [f]: 'export const a = 2;\n' });
    expect(checkParity(root)).toHaveLength(1);
  });
  it('rejects a copy with no reviewed source', () => {
    expect(checkParity(make({ [f]: 'export const a = 1;\n' }))).toHaveLength(1);
  });
});
