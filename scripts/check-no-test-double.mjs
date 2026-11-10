// Fails if a production app build still contains the test double, the SIMULATED label
// or anything shaped like an API key (R2.1, R2.4; steering 40). Run after `npm run build`
// in each app: node scripts/check-no-test-double.mjs apps/planner apps/inventory
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const bad = /test-double|TestDouble|SIMULATED|sk-ant-/;
let failed = false;
for (const app of process.argv.slice(2)) {
  const dir = join(app, 'dist', 'assets');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const m = bad.exec(readFileSync(join(dir, f), 'utf8'));
    if (m) {
      console.error(`FAIL ${join(dir, f)} contains "${m[0]}"`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('check-no-test-double: OK');
