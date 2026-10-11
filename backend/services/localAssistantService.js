'use strict';

// Deterministic answers for common librarian questions. These use the same
// read-only database tools as Gemini, so these questions still work when the
// model is busy, timed out, or out of quota.
const detectIntent = (message) => {
  const text = String(message || '').toLowerCase();
  const period = /\blast month\b/.test(text) ? 'last_month'
    : /\blast 30 days\b/.test(text) ? 'last_30_days'
      : /\blast 6 months\b/.test(text) ? 'last_6_months'
        : /\bthis year\b/.test(text) ? 'this_year'
          : /\bthis month\b/.test(text) ? 'this_month'
            : /\b(all time|ever|overall)\b/.test(text) ? 'all_time' : null;

  const asksOverdue = /\boverdue\b/.test(text);
  const asksFine = /\b(fine|fines|outstanding amount|amount owed)\b/.test(text);
  if (asksOverdue && asksFine) return { tools: [['getOverdueBooks', { limit: 10 }], ['getOutstandingFines', { limit: 10 }]], kind: 'overdue_and_fines' };
  if (asksOverdue) return { tools: [['getOverdueBooks', { limit: 10 }]], kind: 'overdue' };
  if (asksFine) return { tools: [['getOutstandingFines', { limit: 10 }]], kind: 'fines' };

  if (/\b(most frequently issued|most popular|popular books|top books|most borrowed|frequently borrowed)\b/.test(text)) {
    return { tools: [['getPopularBooks', { period: period || 'all_time', limit: 10 }]], kind: 'popular' };
  }

  const asksLastIssue = /\b(last|latest|most recent|recent)\b/.test(text) && /\b(issue|issued|borrow|borrowed|book|member)\b/.test(text);
  if (asksLastIssue) return { tools: [['listIssuedBooks', { period: 'all_time', limit: 1 }]], kind: 'last_issue' };

  if (/\b(pending return|pending returns|not returned|still have|who has)\b/.test(text)) {
    return { tools: [['getPendingReturns', { limit: 10 }]], kind: 'pending' };
  }

  if (/\b(available books|books available|availability|available copies|zero available)\b/.test(text)) {
    return { tools: [['getAvailableBooks', { limit: 10 }]], kind: 'availability' };
  }

  if (/\b(issued|borrowed|loans)\b/.test(text) && period) {
    return { tools: [['listIssuedBooks', { period, limit: 10 }]], kind: 'issued_in_period' };
  }

  if (/\b(trend|statistics|how many.*issued|issued.*how many)\b/.test(text)) {
    return { tools: [['getIssueStatistics', { period: period || 'this_month' }]], kind: 'statistics' };
  }
  return null;
};

const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const periodLabel = (period) => ({
  all_time: 'all time', this_month: 'this month', last_month: 'last month',
  last_30_days: 'the last 30 days', last_6_months: 'the last 6 months', this_year: 'this year',
}[period] || period);

const composeAnswer = (kind, data) => {
  switch (kind) {
    case 'overdue_and_fines': {
      const overdue = data[0];
      const fines = data[1];
      if (!overdue?.ok || !fines?.ok) return 'I could not retrieve all of the overdue and fine records from the library database. Please try again.';
      return `${overdue.data.total} overdue ${overdue.data.total === 1 ? 'record' : 'records'}. Total outstanding fines are ${money(fines.data.combined_total)}.`;
    }
    case 'overdue':
      return data[0]?.ok
        ? `${data[0].data.total} overdue ${data[0].data.total === 1 ? 'record' : 'records'}, with ${money(data[0].data.total_current_fine)} currently accruing in fines.`
        : 'I could not retrieve overdue records from the library database. Please try again.';
    case 'fines':
      return data[0]?.ok
        ? `Total outstanding fines are ${money(data[0].data.combined_total)}. This includes ${money(data[0].data.accruing_on_open_loans.total)} accruing on overdue loans and ${money(data[0].data.unpaid_on_returned_loans.total)} unpaid on returned loans.`
        : 'I could not retrieve fine records from the library database. Please try again.';
    case 'popular': {
      if (!data[0]?.ok) return 'I could not retrieve issue history from the library database. Please try again.';
      const { items, period } = data[0].data;
      if (!items.length) return `There are no issued books recorded for ${periodLabel(period)}.`;
      return `Most frequently issued books (${periodLabel(period)}):\n${items.slice(0, 5).map((b, i) => `${i + 1}. ${b.title} — ${b.times_issued} ${b.times_issued === 1 ? 'issue' : 'issues'}`).join('\n')}`;
    }
    case 'last_issue': {
      if (!data[0]?.ok) return 'I could not retrieve recent issue records from the library database. Please try again.';
      const row = data[0].data.items[0];
      if (!row) return 'There are no book issues recorded yet.';
      return `The most recently issued book was “${row.book_title}”, issued to ${row.member_name}.`;
    }
    case 'pending': {
      if (!data[0]?.ok) return 'I could not retrieve pending returns from the library database. Please try again.';
      const result = data[0].data;
      if (!result.total_open_loans) return 'There are no books currently awaiting return.';
      return `${result.total_open_loans} books are awaiting return across ${result.total_members_with_pending_returns} members.`;
    }
    case 'availability': {
      if (!data[0]?.ok) return 'I could not retrieve availability from the library database. Please try again.';
      const totals = data[0].data.totals;
      return `${totals.available_copies} copies are currently available across ${totals.titles_with_available_copies} book titles.`;
    }
    case 'issued_in_period': {
      if (!data[0]?.ok) return 'I could not retrieve issue history from the library database. Please try again.';
      const result = data[0].data;
      return `${result.total} ${result.total === 1 ? 'book was' : 'books were'} issued for ${periodLabel(result.period)}.`;
    }
    case 'statistics': {
      if (!data[0]?.ok) return 'I could not retrieve borrowing statistics from the library database. Please try again.';
      const result = data[0].data;
      return `${result.issued_in_period} books were issued for ${periodLabel(result.period)}; ${result.returned_in_period} were returned.`;
    }
    default:
      return 'I could not answer that question with a local lookup. Please try rephrasing it.';
  }
};

const answerLocally = async (message, runTool) => {
  const intent = detectIntent(message);
  if (!intent) return null;
  const started = Date.now();
  const results = [];
  for (const [tool, args] of intent.tools) {
    const result = await runTool(tool, args);
    results.push({ tool, args, ...result });
  }
  return {
    answer: composeAnswer(intent.kind, results),
    results,
    meta: {
      model: 'local database lookup',
      iterations: 0,
      tools_used: intent.tools.map(([tool]) => tool),
      tool_errors: results.filter((result) => !result.ok).length,
      duration_ms: Date.now() - started,
    },
  };
};

module.exports = { answerLocally, detectIntent, composeAnswer };
