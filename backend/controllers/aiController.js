'use strict';

const { answerQuestion } = require('../services/aiAssistantService');
const { answerLocally } = require('../services/localAssistantService');
const { createGeminiProvider, AIProviderError } = require('../services/geminiService');
const { getToolDefinitions, runTool, toModelView, todayStr } = require('../tools/librarianTools');

/* ------------------------------- configuration ---------------------------- */

const intEnv = (name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = parseInt(process.env[name], 10);
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
};

const getConfig = () => ({
  apiKey: (process.env.GEMINI_API_KEY || '').trim(),
  model: (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim(),
  maxMessageChars: intEnv('AI_MAX_MESSAGE_CHARS', 500, { min: 20, max: 4000 }),
  maxHistoryMessages: intEnv('AI_MAX_HISTORY_MESSAGES', 8, { min: 0, max: 20 }),
  maxHistoryChars: 1500,
  requestTimeoutMs: intEnv('AI_REQUEST_TIMEOUT_MS', 45000, { min: 5000, max: 120000 }),
  perCallTimeoutMs: intEnv('AI_PROVIDER_CALL_TIMEOUT_MS', 25000, { min: 3000, max: 120000 }),
  maxIterations: intEnv('AI_MAX_TOOL_ITERATIONS', 4, { min: 2, max: 8 }),
  maxOutputTokens: intEnv('GEMINI_MAX_OUTPUT_TOKENS', 4096, { min: 256, max: 16384 }),
  shareMemberNames: String(process.env.AI_SHARE_MEMBER_NAMES || 'false').toLowerCase() !== 'false',
  finePerDay: parseFloat(process.env.FINE_PER_DAY) || 5,
  loanDays: parseInt(process.env.LOAN_DAYS, 10) || 14,
});

/* --------------------------------- helpers -------------------------------- */

const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });

/** Validate { message, history } from the browser. Returns { ok, value } or { ok:false, message }. */
const parseChatBody = (body, cfg) => {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Request body must be JSON.' };

  const { message, history } = body;
  if (typeof message !== 'string') return { ok: false, message: 'A text "message" is required.' };
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, message: 'Please type a question.' };
  if (trimmed.length > cfg.maxMessageChars) {
    return { ok: false, message: `Your question is too long (max ${cfg.maxMessageChars} characters).` };
  }

  let cleanHistory = [];
  if (history !== undefined) {
    if (!Array.isArray(history)) return { ok: false, message: '"history" must be an array.' };
    cleanHistory = history
      .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string' && h.text.trim())
      .map((h) => ({ role: h.role, text: h.text.trim().slice(0, cfg.maxHistoryChars) }))
      .slice(-cfg.maxHistoryMessages);
    // A conversation sent to the model must start with a user turn.
    while (cleanHistory.length && cleanHistory[0].role !== 'user') cleanHistory.shift();
  }
  return { ok: true, value: { message: trimmed, history: cleanHistory } };
};

let cachedProvider = null;
let cachedProviderKey = '';
const getProvider = (cfg) => {
  const key = `${cfg.apiKey}|${cfg.model}|${cfg.perCallTimeoutMs}|${cfg.maxOutputTokens}`;
  if (!cachedProvider || cachedProviderKey !== key) {
    cachedProvider = createGeminiProvider({
      apiKey: cfg.apiKey,
      model: cfg.model,
      timeoutMs: cfg.perCallTimeoutMs,
      maxOutputTokens: cfg.maxOutputTokens,
    });
    cachedProviderKey = key;
  }
  return cachedProvider;
};

/* -------------------------------- handlers -------------------------------- */

// POST /api/ai/chat
const chat = async (req, res) => {
  const cfg = getConfig();

  const parsed = parseChatBody(req.body, cfg);
  if (!parsed.ok) return fail(res, 400, 'INVALID_REQUEST', parsed.message);

  // Common data lookups do not need a generative model and remain available
  // when Gemini is unconfigured, busy, or out of quota.
  let localResult;
  try {
    localResult = await answerLocally(parsed.value.message, runTool);
  } catch (err) {
    console.error(`[ai-local] lookup failed: ${err && err.name}`);
    return fail(res, 500, 'AI_LOCAL_LOOKUP_FAILED', 'The library lookup failed unexpectedly. Please try again.');
  }
  if (localResult) {
    console.log(
      `[ai-local] admin=${req.admin && req.admin.admin_id} tools=${localResult.meta.tools_used.join(',') || '-'} ` +
        `tool_errors=${localResult.meta.tool_errors} ms=${localResult.meta.duration_ms}`
    );
    return res.json({ success: true, data: localResult });
  }

  if (!cfg.apiKey) {
    return fail(res, 503, 'AI_NOT_CONFIGURED', 'AI chat for general questions is not configured on the server yet. Common library lookups are available.');
  }

  try {
    const result = await answerQuestion({
      message: parsed.value.message,
      history: parsed.value.history,
      provider: getProvider(cfg),
      toolDefinitions: getToolDefinitions(),
      runTool,
      toModelView,
      options: {
        maxIterations: cfg.maxIterations,
        maxToolCallsPerStep: 4,
        deadlineMs: cfg.requestTimeoutMs,
        shareMemberNames: cfg.shareMemberNames,
        finePerDay: cfg.finePerDay,
        loanDays: cfg.loanDays,
        today: todayStr(),
      },
    });

    // Privacy-conscious audit line: who, which tools, how long. Never the question or the answer.
    console.log(
      `[ai] admin=${req.admin && req.admin.admin_id} tools=${result.meta.tools_used.join(',') || '-'} ` +
        `iterations=${result.meta.iterations} tool_errors=${result.meta.tool_errors} ms=${result.meta.duration_ms}`
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    const known = err instanceof AIProviderError ? err : null;
    console.error(`[ai] request failed: ${known ? known.code : err && err.name}`);
    if (known) return fail(res, known.status, known.code, known.message);
    return fail(res, 500, 'AI_INTERNAL_ERROR', 'The AI assistant ran into an unexpected problem.');
  }
};

// GET /api/ai/status  (never returns the key)
const status = (req, res) => {
  const cfg = getConfig();
  res.json({
    success: true,
    data: {
      configured: Boolean(cfg.apiKey),
      model: cfg.model,
      tools: getToolDefinitions().map((t) => t.name),
      limits: { max_message_chars: cfg.maxMessageChars, max_history_messages: cfg.maxHistoryMessages },
      member_names_shared_with_ai: cfg.shareMemberNames,
    },
  });
};

module.exports = { chat, status, parseChatBody, getConfig };
