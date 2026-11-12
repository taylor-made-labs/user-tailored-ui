import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../src/schemas/creator-policy.v1.schema.json' with { type: 'json' };
import { runPolicyCheck } from '../src/cli/policy-check.js';
import { JsonPolicySource, PolicyLoadError, checkPolicy, formatIssue, parseCreatorPolicy } from '../src/index.js';

const good = () => ({
  schemaVersion: '1.0.0',
  policyVersion: '1.0.0',
  allowedActions: ['task.create'],
  requiredControls: [{ id: 'complete-task', why: 'Finish tasks.' }],
  allowedComponents: ['board'],
  tokens: {
    fontScale: { type: 'number', min: 1, max: 2 },
    density: { type: 'enum', values: ['compact', 'comfortable'] },
    dark: { type: 'boolean' },
  },
});
type Doc = ReturnType<typeof good> & Record<string, unknown>;
const edit = (f: (d: Doc) => void): unknown => {
  const d = good() as Doc;
  f(d);
  return d;
};

const ajv = new Ajv2020({ strict: true, allowUnionTypes: true });
const ajvValid = ajv.compile(schema);

// [name, mutation, expected issue path, expected rule]
const bad: [string, (d: Doc) => void, string, string][] = [
  ['schemaVersion wrong major', (d) => { d.schemaVersion = '2.0.0'; }, '/schemaVersion', 'pattern'],
  ['policyVersion empty', (d) => { d.policyVersion = ''; }, '/policyVersion', 'minLength'],
  ['policyVersion not a string', (d) => { (d as Record<string, unknown>)['policyVersion'] = 3; }, '/policyVersion', 'type'],
  ['missing allowedActions', (d) => { delete (d as Partial<Doc>).allowedActions; }, '/allowedActions', 'required'],
  ['action bad id', (d) => { d.allowedActions = ['1bad']; }, '/allowedActions/0', 'pattern'],
  ['duplicate action', (d) => { d.allowedActions = ['a', 'a']; }, '/allowedActions/1', 'uniqueItems'],
  ['requiredControls as strings', (d) => { (d as Record<string, unknown>)['requiredControls'] = ['complete-task']; }, '/requiredControls/0', 'type'],
  ['required control typo key', (d) => { (d.requiredControls[0] as Record<string, unknown>)['whyy'] = 'x'; }, '/requiredControls/0/whyy', 'additionalProperties'],
  ['components not a list', (d) => { (d as Record<string, unknown>)['allowedComponents'] = 'board'; }, '/allowedComponents', 'type'],
  ['unknown top-level key', (d) => { d['allowedActons'] = []; }, '/allowedActons', 'additionalProperties'],
  ['token min is a string', (d) => { (d.tokens.fontScale as Record<string, unknown>)['min'] = 'one'; }, '/tokens/fontScale/min', 'type'],
  ['token unknown type', (d) => { (d.tokens as Record<string, unknown>)['x'] = { type: 'range' }; }, '/tokens/x/type', 'oneOf'],
  ['enum token without values', (d) => { (d.tokens as Record<string, unknown>)['x'] = { type: 'enum', values: [] }; }, '/tokens/x/values', 'minItems'],
  ['boolean token with min', (d) => { (d.tokens.dark as Record<string, unknown>)['min'] = 1; }, '/tokens/dark/min', 'additionalProperties'],
  ['min above max', (d) => { d.tokens.fontScale.min = 3; }, '/tokens/fontScale/min', 'min-max'],
  ['layout not enforced yet', (d) => { d['layout'] = { slots: { main: ['board'] } }; }, '/layout', 'not-enforced-yet'],
  ['inference not enforced yet', (d) => { d['inference'] = { keyModes: ['byok'] }; }, '/inference', 'not-enforced-yet'],
  ['color token not enforced yet', (d) => { (d.tokens as Record<string, unknown>)['accent'] = { type: 'color', minContrastAgainst: '#ffffff', minRatio: 4.5 }; }, '/tokens/accent', 'not-enforced-yet'],
];

describe('creator-policy.v1 schema', () => {
  it('is valid under Ajv strict', () => {
    expect(ajvValid).toBeTypeOf('function');
  });

  it('gives every field a description and an example (R4.5)', () => {
    const missing: string[] = [];
    const defs = (schema as { $defs: Record<string, unknown> }).$defs;
    const visit = (s: Record<string, unknown>, at: string, isField: boolean): void => {
      const ref = typeof s['$ref'] === 'string' ? (defs[(s['$ref'] as string).replace('#/$defs/', '')] as Record<string, unknown>) : {};
      const has = (k: string): boolean => s[k] !== undefined || ref[k] !== undefined;
      if (isField && (!has('description') || !has('examples'))) missing.push(at);
      for (const [k, v] of Object.entries((s['properties'] ?? {}) as Record<string, Record<string, unknown>>)) visit(v, `${at}/${k}`, true);
      if (s['items']) visit(s['items'] as Record<string, unknown>, `${at}/items`, false);
    };
    visit(schema as Record<string, unknown>, '', false);
    for (const [k, v] of Object.entries(defs)) visit(v as Record<string, unknown>, `$defs/${k}`, false);
    expect(missing).toEqual([]);
  });

  it('accepts a good file (loader and Ajv agree)', () => {
    expect(ajvValid(good())).toBe(true);
    expect(checkPolicy(good())).toEqual([]);
  });

  it.each(bad)('rejects: %s', (_name, mutate, path, rule) => {
    const doc = edit(mutate);
    const issues = checkPolicy(doc);
    expect(issues.map((i) => [i.path, i.rule])).toContainEqual([path, rule]);
    for (const i of issues) {
      expect(i.message.length).toBeGreaterThan(0);
      expect(i.hint.length).toBeGreaterThan(0);
    }
    // Schema-level problems must also fail Ajv; semantic ones (min-max, not-enforced-yet) are loader-only.
    if (!['min-max', 'not-enforced-yet'].includes(rule)) expect(ajvValid(doc)).toBe(false);
  });

  it('writes errors as path: message. hint (R4.4)', () => {
    const issues = checkPolicy(edit((d) => { (d.tokens.fontScale as Record<string, unknown>)['min'] = 'one'; }));
    expect(formatIssue(issues[0]!)).toBe('/tokens/fontScale/min: expected number, got "one". Use a number such as 1.');
  });
});

describe('JsonPolicySource', () => {
  it('maps a good file to a CreatorPolicy', () => {
    expect(new JsonPolicySource(good()).load()).toEqual({
      version: '1.0.0',
      allowedActions: ['task.create'],
      requiredControls: ['complete-task'],
      allowedComponents: ['board'],
      tokenRules: {
        fontScale: { kind: 'number', min: 1, max: 2 },
        density: { kind: 'enum', values: ['compact', 'comfortable'] },
        dark: { kind: 'boolean' },
      },
    });
  });

  it('fails closed with every issue on a bad file', () => {
    expect(() => parseCreatorPolicy(edit((d) => { d.policyVersion = ''; d.allowedActions = ['1']; }))).toThrow(PolicyLoadError);
  });

  it('reports invalid JSON text', () => {
    expect(() => parseCreatorPolicy('{ nope')).toThrow(/not valid JSON/);
  });
});

describe('policy:check', () => {
  const planner = 'apps/planner/creator-policy.json';
  const inventory = 'apps/inventory/creator-policy.json';

  it('passes both shipped app policies', () => {
    const r = runPolicyCheck([planner, inventory]);
    expect(r.out).toEqual([`ok    ${planner}`, `ok    ${inventory}`]);
    expect(r.code).toBe(0);
  });

  it('exits non-zero with readable output on a bad file', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'pc-')), 'bad.json');
    writeFileSync(f, JSON.stringify(edit((d) => { d.policyVersion = ''; })));
    const r = runPolicyCheck([f]);
    expect(r.code).toBe(1);
    expect(r.out.join('\n')).toContain('/policyVersion: must not be empty.');
  });

  it('exits 1 on a missing file and 2 on no args', () => {
    expect(runPolicyCheck(['/no/such/file.json']).code).toBe(1);
    expect(runPolicyCheck([]).code).toBe(2);
  });
});
