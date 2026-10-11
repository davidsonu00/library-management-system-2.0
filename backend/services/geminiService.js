'use strict';

/**
 * Gemini provider adapter.
 *
 * This is the ONLY file that knows about the Google SDK. The rest of the AI feature talks to the
 * small provider interface below, so replacing Gemini later means writing one new adapter:
 *
 *   provider.name, provider.model
 *   provider.createSession({ systemInstruction, tools, history }) -> session
 *   session.sendUserMessage(text, { signal })       -> Promise<Step>
 *   session.sendToolResults(results, { signal })    -> Promise<Step>
 *      where results = [{ id?, name, result }]  and  Step = { text, toolCalls: [{ id?, name, args }] }
 *
 * Errors are normalised to AIProviderError with a stable `code` and an HTTP `status` that is safe
 * to return to the browser. Note: provider 401/403 are deliberately mapped to 502, because the
 * frontend's axios interceptor logs the librarian out on any 401.
 */

const { GoogleGenAI, Type } = require('@google/genai');

class AIProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.status = status;
  }
}

const TYPE_MAP = { string: Type.STRING, integer: Type.INTEGER };

/** Provider-neutral tool definitions -> Gemini functionDeclarations. */
const toFunctionDeclarations = (tools) =>
  tools.map((tool) => {
    const properties = {};
    const required = [];
    for (const [key, rule] of Object.entries(tool.params)) {
      const prop = { type: rule.type === 'enum' ? Type.STRING : TYPE_MAP[rule.type], description: rule.description };
      if (rule.type === 'enum') prop.enum = rule.values;
      properties[key] = prop;
      if (rule.required) required.push(key);
    }
    return {
      name: tool.name,
      description: tool.description,
      parameters: { type: Type.OBJECT, properties, ...(required.length ? { required } : {}) },
    };
  });

const isAbort = (err) =>
  err && (err.name === 'AbortError' || err.name === 'TimeoutError' || /aborted|timed? ?out/i.test(String(err.message)));

/** Map any SDK/network failure to a safe, stable AIProviderError. */
const normaliseError = (err) => {
  if (err instanceof AIProviderError) return err;
  if (isAbort(err)) {
    return new AIProviderError('AI_TIMEOUT', 'The AI service took too long to respond. Please try again.', 504);
  }
  const status = Number(err && err.status);
  const message = String((err && err.message) || '');
  if (status === 429) {
    return new AIProviderError('AI_QUOTA_EXCEEDED', 'The AI service quota or rate limit has been reached. Please wait a bit and try again.', 429);
  }
  if (status === 401 || status === 403 || (status === 400 && /api key|API_KEY/i.test(message))) {
    return new AIProviderError('AI_AUTH_FAILED', 'The AI service rejected the server credentials. Please contact the administrator.', 502);
  }
  if (status === 404) {
    return new AIProviderError('AI_MODEL_UNAVAILABLE', 'The configured AI model is not available. Please contact the administrator.', 502);
  }
  if (status === 400) {
    return new AIProviderError('AI_BAD_REQUEST', 'The AI service could not process this request.', 502);
  }
  if (status >= 500 || !status) {
    return new AIProviderError('AI_UNAVAILABLE', 'The AI service is temporarily unavailable. Please try again shortly.', 503);
  }
  return new AIProviderError('AI_PROVIDER_ERROR', 'The AI service returned an unexpected error.', 502);
};

const textOf = (content) =>
  ((content && content.parts) || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();

/**
 * @param {{ apiKey: string, model: string, timeoutMs?: number, maxOutputTokens?: number, client?: object }} opts
 *   `client` can be injected for tests; it must expose models.generateContent(params).
 */
const createGeminiProvider = ({ apiKey, model, timeoutMs = 20000, maxOutputTokens = 4096, client }) => {
  if (!client && !apiKey) {
    throw new AIProviderError('AI_NOT_CONFIGURED', 'The AI assistant is not configured on the server.', 503);
  }
  const ai = client || new GoogleGenAI({ apiKey });

  return {
    name: 'gemini',
    model,

    createSession({ systemInstruction, tools, history = [] }) {
      const functionDeclarations = toFunctionDeclarations(tools);
      // Gemini roles are 'user' and 'model'. History is text only (no tool payloads are replayed).
      const contents = history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }],
      }));

      const generate = async (signal) => {
        let response;
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations }],
              temperature: 0.2,
              maxOutputTokens,
              abortSignal: signal,
              // Retry only transient model-capacity failures once. Quota and other
              // errors are not retried, so failures cannot silently multiply usage.
              httpOptions: {
                timeout: timeoutMs,
                retryOptions: {
                  attempts: 2,
                  initialDelay: 1,
                  maxDelay: 1,
                  jitter: 0,
                  httpStatusCodes: [503],
                },
              },
            },
          });
        } catch (err) {
          throw normaliseError(err);
        }

        const candidate = response && response.candidates && response.candidates[0];
        const content = candidate && candidate.content;
        if (!content || !Array.isArray(content.parts) || content.parts.length === 0) {
          const blocked = (response && response.promptFeedback && response.promptFeedback.blockReason) ||
            (candidate && candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason));
          throw new AIProviderError(
            blocked ? 'AI_BLOCKED' : 'AI_BAD_RESPONSE',
            blocked
              ? 'The AI service declined to answer that request. Try rephrasing it.'
              : 'The AI service returned an empty response. Please try again.',
            blocked ? 422 : 502
          );
        }

        // Keep the model's Content exactly as returned (preserves thought signatures for Gemini 3 models).
        contents.push(content);

        const toolCalls = content.parts
          .filter((p) => p.functionCall && p.functionCall.name)
          .map((p) => ({ id: p.functionCall.id, name: p.functionCall.name, args: p.functionCall.args || {} }));

        return { text: textOf(content), toolCalls, finishReason: candidate.finishReason };
      };

      return {
        async sendUserMessage(text, { signal } = {}) {
          contents.push({ role: 'user', parts: [{ text }] });
          return generate(signal);
        },
        async sendToolResults(results, { signal } = {}) {
          contents.push({
            role: 'user',
            parts: results.map((r) => ({
              functionResponse: { ...(r.id ? { id: r.id } : {}), name: r.name, response: r.result },
            })),
          });
          return generate(signal);
        },
      };
    },
  };
};

module.exports = { createGeminiProvider, AIProviderError, normaliseError, toFunctionDeclarations };
