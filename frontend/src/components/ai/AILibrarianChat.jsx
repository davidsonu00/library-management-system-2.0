import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperAirplaneIcon, SparklesIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import api from '../../utils/api';
import AIResultView from './AIResultView';

const SUGGESTIONS = [
  'Show all overdue books',
  'Which Python books are currently available?',
  'How many books are available in the library?',
  'Which members have pending book returns?',
  'Show the books issued this month',
  'Which books are the most frequently issued?',
  'Find books that have zero available copies',
  'How many overdue records are there, and what is the total outstanding fine?',
  'Explain the library’s current borrowing trends',
];

const MAX_CHARS = 500;
const HISTORY_TURNS = 8;
// The server allows up to 45 s for a question; give the browser a little longer.
const REQUEST_TIMEOUT_MS = 60000;

const friendlyError = (err) => {
  if (err.code === 'ECONNABORTED') return { message: 'That took too long. Please try again, or ask a more specific question.' };
  if (!err.response) return { message: 'Cannot reach the server. Check your internet connection and try again.' };
  const { code, message } = err.response.data || {};
  if (err.response.status === 429 && code === 'AI_QUOTA_EXCEEDED') return { message: 'The AI service quota has been reached. Please wait a while and try again.' };
  return { message: message || 'Something went wrong. Please try again.' };
};

let nextId = 1;
const newId = () => `m${nextId++}`;

export default function AILibrarianChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const sendingRef = useRef(false); // synchronous guard against double submits
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.get('/api/ai/status', { skipErrorToast: true })
      .then((res) => setStatus(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = useCallback(async (raw) => {
    const text = (raw ?? '').trim();
    if (!text || sendingRef.current) return;
    if (text.length > MAX_CHARS) return;

    sendingRef.current = true;
    setSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Conversation context = prior successful text turns only (kept in memory, never stored).
    const history = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { id: newId(), role: 'user', text }]);

    try {
      const { data } = await api.post(
        '/api/ai/chat',
        { message: text, history },
        { timeout: REQUEST_TIMEOUT_MS, skipErrorToast: true }
      );
      const { answer, results, meta } = data.data;
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', text: answer, results, meta }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', text: friendlyError(err).message, error: true, retryText: text },
      ]);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [messages]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const onInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  const clearChat = () => {
    if (sendingRef.current) return;
    setMessages([]);
    setInput('');
  };

  const notConfigured = status && !status.configured;
  const tooLong = input.length > MAX_CHARS;

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-7rem)] animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-primary-600" /> AI Librarian
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Ask questions about your library in plain English. Answers come from your live records.</p>
        </div>
        <button className="btn-secondary flex-shrink-0" onClick={clearChat} disabled={sending || messages.length === 0}>
          <ArrowPathIcon className="w-4 h-4" /> <span className="hidden sm:inline">New chat</span>
        </button>
      </div>

      {notConfigured && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex-shrink-0">
          <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
          <span>The AI assistant is not configured on the server yet (missing <code className="font-mono">GEMINI_API_KEY</code>).</span>
        </div>
      )}

      {/* Conversation */}
      <div className="card flex-1 min-h-0 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
              <SparklesIcon className="w-6 h-6 text-primary-600" />
            </div>
            <p className="font-display font-bold text-slate-800">How can I help today?</p>
            <p className="text-sm text-slate-500 mt-1 mb-5">Try one of these:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTIONS.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending || notConfigured}
                  className="text-left text-sm text-slate-700 bg-slate-50 hover:bg-primary-50 hover:text-primary-700 border border-slate-100 rounded-xl px-3 py-2.5 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-full sm:max-w-[92%] w-full'}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : m.error
                      ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                {m.text}
              </div>
              {m.error && m.retryText && (
                <button className="mt-1.5 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50" disabled={sending} onClick={() => send(m.retryText)}>
                  Try again
                </button>
              )}
              {!m.error && m.meta?.tool_errors > 0 && (
                <p className="mt-1.5 text-xs text-amber-700">Some data could not be retrieved, so this answer may be incomplete.</p>
              )}
              {m.role === 'assistant' && !m.error && <AIResultView results={m.results} />}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Checking the library records…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="mt-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder="Ask about books, members, overdue items, fines…"
            className="input resize-none max-h-32"
            disabled={notConfigured}
            aria-label="Ask the AI Librarian"
          />
          <button
            className="btn-primary h-[38px] flex-shrink-0"
            onClick={() => send(input)}
            disabled={sending || !input.trim() || tooLong || notConfigured}
            aria-label="Send"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-slate-400">
          <span>
            Read-only. Common book, issue, overdue, return, and fine lookups stay in LibraryOS. Other questions send relevant records{status?.member_names_shared_with_ai === false ? ' (member names are redacted)' : ' (including member names)'} to Google Gemini. Always verify important figures in the tables.
          </span>
          {input.length > MAX_CHARS - 100 && <span className={tooLong ? 'text-red-500' : ''}>{input.length}/{MAX_CHARS}</span>}
        </div>
      </div>
    </div>
  );
}
