/**
 * VENDORED from @taylor-made-labs/user-tailored-ui (src/domain/customization/json-policy.ts).
 * Faithful copy; re-vendor rather than edit here.
 */
/**
 * JsonPolicySource: loads a `creator-policy.json`, checks it against the shipped JSON
 * Schema (`schemas/creator-policy.v1.schema.json`) and maps it to a `CreatorPolicy`.
 *
 * Fails closed: any problem throws `PolicyLoadError` and no policy is returned.
 * Every problem carries the JSON path, the rule, the bad value and a fix hint.
 *
 * The schema walker below is deliberately small and covers only the keywords the schema
 * uses. It avoids a runtime dependency and `eval`/`new Function` (Ajv generates code,
 * which the app boundary forbids). Tests cross-check it against Ajv in strict mode.
 * shortcut: new schema keywords must be added to `walk`; the Ajv cross-check test fails if not.
 */

import type { CreatorPolicy, TokenRule } from './policy.js';
import schema from '../../schemas/creator-policy.v1.schema.json' with { type: 'json' };

/** One problem in a policy file. */
export interface PolicyIssue {
  /** JSON pointer to the bad spot ("" is the whole file). */
  readonly path: string;
  /** Rule that failed, e.g. `type`, `required`, `additionalProperties`, `min-max`. */
  readonly rule: string;
  /** The offending value (undefined when a key is missing). */
  readonly value: unknown;
  readonly message: string;
  readonly hint: string;
}

/** Thrown when a policy file is not valid. `message` lists every issue, one per line. */
export class PolicyLoadError extends Error {
  readonly issues: readonly PolicyIssue[];
  constructor(issues: readonly PolicyIssue[]) {
    super(issues.map(formatIssue).join('\n'));
    this.name = 'PolicyLoadError';
    this.issues = issues;
  }
}

/** Where a policy comes from. Apps depend on this port, not on JSON. */
export interface PolicySource {
  load(): CreatorPolicy;
}

type Json = Record<string, unknown>;

export function formatIssue(i: PolicyIssue): string {
  return `${i.path === '' ? '/' : i.path}: ${i.message}. ${i.hint}`;
}

function show(v: unknown): string {
  const s = JSON.stringify(v);
  return s === undefined ? 'nothing' : s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function jsonType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function isType(v: unknown, t: string): boolean {
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v);
  return jsonType(v) === t;
}

function resolve(s: Json): Json {
  const ref = s['$ref'];
  if (typeof ref !== 'string') return s;
  const target = ref.replace('#/$defs/', '');
  const def = ((schema as Json)['$defs'] as Record<string, Json>)[target];
  if (def === undefined) throw new Error(`schema: unresolved ${ref}`);
  return { ...def, ...s, $ref: undefined };
}

function sampleHint(s: Json, type: string): string {
  const ex = (s['examples'] as unknown[] | undefined)?.[0];
  const word = type === 'array' ? 'a list' : type === 'object' ? 'an object' : `a ${type}`;
  return ex === undefined ? `Use ${word}.` : `Use ${word} such as ${show(ex)}.`;
}

function walk(value: unknown, sIn: Json, path: string, out: PolicyIssue[]): void {
  const s = resolve(sIn);
  const add = (rule: string, message: string, hint: string, p = path, v = value): void => {
    out.push({ path: p, rule, value: v, message, hint });
  };

  if ('const' in s && value !== s['const']) {
    add('const', `expected ${show(s['const'])}, got ${show(value)}`, `Use ${show(s['const'])}.`);
    return;
  }
  const types = s['type'] === undefined ? [] : ([] as string[]).concat(s['type'] as string | string[]);
  if (types.length > 0 && !types.some((t) => isType(value, t))) {
    add('type', `expected ${types.join(' or ')}, got ${show(value)}`, sampleHint(s, types[0] as string));
    return;
  }
  const oneOf = s['oneOf'] as Json[] | undefined;
  if (oneOf !== undefined) {
    // Branches are told apart by their `type` const, so errors name the branch the file meant.
    const kinds = oneOf.map((b) => resolve(b)).map((b) => ((b['properties'] as Json)['type'] as Json)['const']);
    const picked = oneOf.find((_, i) => value !== null && typeof value === 'object' && (value as Json)['type'] === kinds[i]);
    if (picked === undefined) {
      add('oneOf', `"type" must be one of ${kinds.map((k) => show(k)).join(', ')}, got ${show((value as Json)['type'])}`, `Set "type" to one of ${kinds.map((k) => show(k)).join(', ')}.`, `${path}/type`, (value as Json)['type']);
      return;
    }
    walk(value, picked, path, out);
    return;
  }
  if (Array.isArray(s['enum']) && !s['enum'].includes(value)) {
    add('enum', `expected one of ${s['enum'].map((x) => show(x)).join(', ')}, got ${show(value)}`, `Use one of ${s['enum'].map((x) => show(x)).join(', ')}.`);
  }
  if (typeof value === 'string') {
    if (typeof s['minLength'] === 'number' && value.length < s['minLength']) add('minLength', `must not be empty`, sampleHint(s, 'string'));
    if (typeof s['pattern'] === 'string' && !new RegExp(s['pattern']).test(value)) {
      add('pattern', `${show(value)} has the wrong format`, `${String(s['description'] ?? 'Check the format.')} ${sampleHint(s, 'string')}`);
    }
  }
  if (typeof value === 'number') {
    if (typeof s['minimum'] === 'number' && value < s['minimum']) add('minimum', `${value} is below the minimum ${s['minimum']}`, `Use ${s['minimum']} or more.`);
    if (typeof s['maximum'] === 'number' && value > s['maximum']) add('maximum', `${value} is above the maximum ${s['maximum']}`, `Use ${s['maximum']} or less.`);
  }
  if (Array.isArray(value)) {
    if (typeof s['minItems'] === 'number' && value.length < s['minItems']) add('minItems', `needs at least ${s['minItems']} item(s)`, sampleHint(s, 'array'));
    if (s['uniqueItems'] === true) {
      const seen = new Set<string>();
      value.forEach((item, i) => {
        const k = JSON.stringify(item);
        if (seen.has(k)) add('uniqueItems', `duplicate item ${show(item)}`, 'Remove the repeated item.', `${path}/${i}`, item);
        seen.add(k);
      });
    }
    if (s['items'] !== undefined) value.forEach((item, i) => walk(item, s['items'] as Json, `${path}/${i}`, out));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Json;
    const props = (s['properties'] ?? {}) as Record<string, Json>;
    for (const key of (s['required'] ?? []) as string[]) {
      if (!(key in obj)) {
        const first = String((props[key] ? resolve(props[key]) : {})['description'] ?? '').split('. ')[0];
        add('required', `missing required key "${key}"`, `Add "${key}"${first ? ` (${first})` : ''}.`, `${path}/${key}`, undefined);
      }
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = props[key];
      if (sub !== undefined) walk(v, sub, `${path}/${key}`, out);
      else if (s['additionalProperties'] === false) {
        const allowed = Object.keys(props).join(', ');
        add('additionalProperties', `unknown key "${key}"`, `Allowed keys: ${allowed}. Check for a typo.`, `${path}/${key}`, v);
      } else if (typeof s['additionalProperties'] === 'object') walk(v, s['additionalProperties'] as Json, `${path}/${key}`, out);
    }
  }
}

/** Checks rules the schema cannot express, and rejects features that are not enforced yet. */
function semantic(file: Json, out: PolicyIssue[]): void {
  const notYet = (path: string, what: string, task: string, value: unknown): void => {
    out.push({ path, rule: 'not-enforced-yet', value, message: `${what} is not enforced yet`, hint: `Remove it until ${task} lands, so no rule is silently ignored.` });
  };
  if ('layout' in file) notYet('/layout', '"layout"', 'task T2.6', file['layout']);
  if ('inference' in file) notYet('/inference', '"inference"', 'the inference settings (R3)', file['inference']);
  const tokens = file['tokens'];
  if (tokens === null || typeof tokens !== 'object') return;
  for (const [name, raw] of Object.entries(tokens as Json)) {
    const t = raw as Json;
    if (t['type'] === 'color') notYet(`/tokens/${name}`, 'a "color" token', 'task T2.6', raw);
    if (t['type'] === 'number' && typeof t['min'] === 'number' && typeof t['max'] === 'number' && t['min'] > t['max']) {
      out.push({ path: `/tokens/${name}/min`, rule: 'min-max', value: t['min'], message: `min ${t['min']} is above max ${t['max']}`, hint: 'Make min less than or equal to max.' });
    }
  }
}

function toTokenRule(t: Json): TokenRule {
  if (t['type'] === 'number') {
    return {
      kind: 'number',
      ...(typeof t['min'] === 'number' ? { min: t['min'] } : {}),
      ...(typeof t['max'] === 'number' ? { max: t['max'] } : {}),
    };
  }
  if (t['type'] === 'enum') return { kind: 'enum', values: t['values'] as (string | number | boolean)[] };
  return { kind: 'boolean' };
}

/** Validates parsed JSON and returns every issue found (empty = valid). */
export function checkPolicy(input: unknown): PolicyIssue[] {
  const out: PolicyIssue[] = [];
  walk(input, schema as Json, '', out);
  if (out.length === 0) semantic(input as Json, out);
  return out;
}

/** Loads a policy from JSON text or an already parsed object. Throws `PolicyLoadError`. */
export function parseCreatorPolicy(input: unknown): CreatorPolicy {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new PolicyLoadError([{ path: '', rule: 'json', value: undefined, message: `not valid JSON (${(e as Error).message})`, hint: 'Fix the syntax: check commas, quotes and brackets.' }]);
    }
  }
  const issues = checkPolicy(data);
  if (issues.length > 0) throw new PolicyLoadError(issues);
  const f = data as Json;
  const tokenRules: Record<string, TokenRule> = {};
  for (const [name, t] of Object.entries(f['tokens'] as Record<string, Json>)) tokenRules[name] = toTokenRule(t);
  return {
    version: f['policyVersion'] as string,
    allowedActions: f['allowedActions'] as string[],
    requiredControls: (f['requiredControls'] as { id: string }[]).map((c) => c.id),
    allowedComponents: f['allowedComponents'] as string[],
    tokenRules,
  };
}

/** `PolicySource` backed by a creator-policy JSON document (text or parsed). */
export class JsonPolicySource implements PolicySource {
  constructor(private readonly doc: unknown) {}
  load(): CreatorPolicy {
    return parseCreatorPolicy(this.doc);
  }
}
