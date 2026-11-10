/**
 * Holds whether an API key is present, and lets the user set or clear it for the
 * session. The key itself is never put in React state: only a boolean is.
 */
import { useCallback, useEffect, useState } from 'react';
import { SecretString, type KeyStore } from '../ports/foundation.js';

export interface ApiKeyState {
  readonly hasKey: boolean;
  readonly setKey: (value: string) => Promise<void>;
  readonly clearKey: () => Promise<void>;
}

export function useApiKey(keys: KeyStore): ApiKeyState {
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    void keys.get().then((k) => setHasKey(k !== undefined));
  }, [keys]);
  const setKey = useCallback(
    async (value: string) => {
      const v = value.trim();
      if (!v) return;
      await keys.set(new SecretString(v));
      setHasKey(true);
    },
    [keys],
  );
  const clearKey = useCallback(async () => {
    await keys.clear();
    setHasKey(false);
  }, [keys]);
  return { hasKey, setKey, clearKey };
}
