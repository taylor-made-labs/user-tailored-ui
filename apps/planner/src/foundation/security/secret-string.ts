/**
 * SecretString: an opaque holder for an API key (R3.3, R3.4).
 *
 * The value is a true private field. It is not an own property, so JSON.stringify,
 * Object.keys, spread, structuredClone and console/util.inspect all see nothing.
 * `toString`, `toJSON` and the Node inspect hook print "[redacted]". The only way
 * to read the value is the explicit `reveal()` call, which only the transport
 * (request header) and the key store should use.
 */
const REDACTED = '[redacted]';

export class SecretString {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** The raw secret. Call only at the point of use (HTTP header, key store write). */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }

  [Symbol.toPrimitive](): string {
    return REDACTED;
  }
}

/** Removes every occurrence of the secret from free text (e.g. provider error text). */
export function scrub(text: string, secret: SecretString | undefined): string {
  const raw = secret?.reveal();
  return raw ? text.split(raw).join(REDACTED) : text;
}
