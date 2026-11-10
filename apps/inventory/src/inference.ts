/**
 * Product inference wiring (R2.1, R3). Real Anthropic only.
 *
 * - Managed / broker: set VITE_BROKER_URL. The browser sends no key through the broker
 *   unless the user entered one (BYOK pass-through).
 * - Direct BYOK (no broker URL): browser to api.anthropic.com with the user's own key.
 *   This exposes the key to the page, so the UI labels it.
 * The test double is NOT referenced here. It is wired only in main.tsx behind the
 * VITE_ENABLE_TEST_DOUBLE dev flag, which production builds fold away.
 */
import {
  AnthropicMessagesAdapter,
  InferenceError,
  type InferenceProvider,
  type InferenceRequest,
  type InferenceResponse,
  type KeyStore,
} from './ports/foundation.js';

export const BROKER_URL: string | undefined = import.meta.env.VITE_BROKER_URL || undefined;

export function createProductInference(keys: KeyStore): InferenceProvider {
  return {
    id: 'anthropic',
    simulated: false,
    async propose(request: InferenceRequest): Promise<InferenceResponse> {
      const apiKey = await keys.get();
      if (!apiKey && !BROKER_URL) {
        throw new InferenceError('auth', 'Add your Anthropic API key to ask the agent.');
      }
      return new AnthropicMessagesAdapter({
        ...(apiKey ? { apiKey } : {}),
        ...(BROKER_URL ? { baseURL: BROKER_URL } : { direct: true }),
      }).propose(request);
    },
  };
}
