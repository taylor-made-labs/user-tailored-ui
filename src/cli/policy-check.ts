#!/usr/bin/env node
/**
 * `npm run policy:check -- <file>...` validates creator-policy.json files.
 * Exit 0 = all valid, 1 = a problem (printed), 2 = bad usage.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PolicyLoadError, formatIssue, parseCreatorPolicy } from '../domain/customization/json-policy.js';

export function runPolicyCheck(files: readonly string[]): { code: number; out: string[] } {
  if (files.length === 0) return { code: 2, out: ['usage: policy:check <creator-policy.json>...'] };
  const out: string[] = [];
  let code = 0;
  for (const file of files) {
    try {
      parseCreatorPolicy(readFileSync(file, 'utf8'));
      out.push(`ok    ${file}`);
    } catch (e) {
      code = 1;
      out.push(`FAIL  ${file}`);
      if (e instanceof PolicyLoadError) out.push(...e.issues.map((i) => `  ${formatIssue(i)}`));
      else out.push(`  ${(e as Error).message}`);
    }
  }
  return { code, out };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out } = runPolicyCheck(process.argv.slice(2));
  console.log(out.join('\n'));
  process.exitCode = code;
}
