/**
 * The auto-merge "needs human-approved label" path list. Single source of truth:
 * .github/workflows/auto-merge.yml imports this file (checked out from the default branch,
 * never from the PR), and test/sensitive-paths.test.ts pins the behavior.
 *
 * Narrow on purpose. A path is listed only if a change to it could weaken the gate,
 * the license, or leak a credential. Everything else auto-merges on green checks.
 *
 * NOT listed any more (see PR body):
 *   - apps/<app>/src/foundation/**  -> scripts/vendored-parity.mjs (CI) proves each copy
 *                                      matches its reviewed source in src/.
 *   - the word "secret"/"credential" inside a source file name (e.g. secret-string.ts)
 */
export const SENSITIVE_PATTERNS = [
  // Source-of-truth enforcement code.
  /(^|\/)src\/domain\/customization\/(validator|orchestrator|policy)\.ts$/,
  // The gate itself: workflows and the scripts/rules they run.
  /(^|\/)\.github\/workflows\/.+\.ya?ml$/,
  // Includes every script the review and fix agents run, so neither can edit its own rules.
  /(^|\/)scripts\/(boundary-check|dep-hygiene|vendored-parity|sensitive-paths|semantic-review|agent-fix)\.mjs$/,
  /(^|\/)\.kiro\/agents\/customization-boundary-reviewer\.json$/,
  // Relays users' API keys.
  /(^|\/)src\/broker\//,
  // Licensing.
  /(^|\/)(LICENSE|NOTICE)/i,
  // Real credential files: dotenv (templates excepted), key material, secret/credential
  // files or directories named as such.
  /(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /(^|\/)(secrets?|credentials?)(\.[^/]+)?$/i,
  /(^|\/)(secrets?|credentials?)\//i,
];

export const isSensitive = (path) => SENSITIVE_PATTERNS.some((rx) => rx.test(path));
