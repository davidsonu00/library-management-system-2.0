import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Renders the REAL data the backend retrieved from the database for an AI answer.
 * Everything here comes from `results[]` in the API response, never from the model's text,
 * so the librarian can always verify what the assistant says.
 */

const TOOL_LABELS = {
  searchBooks: 'Book search',
  getAvailableBooks: 'Book availability',
  getOverdueBooks: 'Overdue loans',
  getPendingReturns: 'Pending returns',
  getIssueStatistics: 'Issue statistics',
  listIssuedBooks: 'Issued books',
  getPopularBooks: 'Most issued books',
  getMemberIssueHistory: 'Member history',
  getOutstandingFines: 'Outstanding fines',
};

const formatDate = (d) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const money = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);

const STATUS_BADGE = { overdue: 'badge-red', issued: 'badge-amber', returned: 'badge-green' };
const KIND_LABEL = { accruing_on_open_loan: 'Accruing', unpaid_on_returned_loan: 'Unpaid' };

// column: [key, label, formatter?]
const COLUMNS = {
  searchBooks: [['title', 'Title'], ['author', 'Author'], ['category', 'Category'], ['available_copies', 'Available'], ['total_copies', 'Total']],
  getAvailableBooks: [['title', 'Title'], ['author', 'Author'], ['category', 'Category'], ['available_copies', 'Available'], ['total_copies', 'Total']],
  getOverdueBooks: [['member_name', 'Member'], ['book_title', 'Book'], ['due_date', 'Due', formatDate], ['days_overdue', 'Days late'], ['current_fine', 'Fine', money]],
  getPendingReturns: [['member_name', 'Member'], ['open_loans', 'Open'], ['overdue_loans', 'Overdue'], ['earliest_due_date', 'Earliest due', formatDate]],
  listIssuedBooks: [['member_name', 'Member'], ['book_title', 'Book'], ['issue_date', 'Issued', formatDate], ['due_date', 'Due', formatDate], ['status', 'Status', (v) => <span className={STATUS_BADGE[v] || 'badge-slate'}>{v}</span>]],
  getPopularBooks: [['rank', '#'], ['title', 'Title'], ['author', 'Author'], ['times_issued', 'Issues']],
  getMemberIssueHistory: [['book_title', 'Book'], ['issue_date', 'Issued', formatDate], ['due_date', 'Due', formatDate], ['return_date', 'Returned', formatDate], ['status', 'Status', (v) => <span className={STATUS_BADGE[v] || 'badge-slate'}>{v}</span>], ['fine', 'Fine', money]],
  getOutstandingFines: [['member_name', 'Member'], ['book_title', 'Book'], ['kind', 'Type', (v) => KIND_LABEL[v] || v], ['fine', 'Fine', money]],
};

const itemsOf = (result) => {
  const d = result.data || {};
  if (result.tool === 'getAvailableBooks') return d.matches?.items || [];
  return d.items || [];
};

const Chip = ({ label, value, tone = 'slate' }) => (
  <div className={`rounded-xl border px-3 py-2 ${tone === 'red' ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`text-base font-bold ${tone === 'red' ? 'text-red-700' : 'text-slate-800'}`}>{value}</p>
  </div>
);

const Summary = ({ result }) => {
  const d = result.data || {};
  switch (result.tool) {
    case 'getOverdueBooks':
      return (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Chip label="Overdue loans" value={d.total} tone="red" />
          <Chip label="Total fine" value={money(d.total_current_fine)} tone="red" />
        </div>
      );
    case 'getAvailableBooks':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Chip label="Titles" value={d.totals?.book_titles} />
          <Chip label="Copies available" value={`${d.totals?.available_copies} / ${d.totals?.total_copies}`} />
          <Chip label="Titles in stock" value={d.totals?.titles_with_available_copies} />
          <Chip label="Titles at zero" value={d.totals?.titles_with_zero_available_copies} />
        </div>
      );
    case 'getOutstandingFines':
      return (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Chip label="Accruing now" value={money(d.accruing_on_open_loans?.total)} tone="red" />
          <Chip label="Unpaid (returned)" value={money(d.unpaid_on_returned_loans?.total)} />
          <Chip label="Combined" value={money(d.combined_total)} tone="red" />
        </div>
      );
    case 'getPendingReturns':
      return (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Chip label="Members" value={d.total_members_with_pending_returns} />
          <Chip label="Open loans" value={d.total_open_loans} />
        </div>
      );
    case 'getIssueStatistics':
      return (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Chip label="Issued" value={d.issued_in_period} />
            <Chip label="Returned" value={d.returned_in_period} />
            <Chip label="Open now" value={d.currently_open_loans} />
            <Chip label="Overdue now" value={d.currently_overdue_loans} tone="red" />
          </div>
          {d.issued_in_previous_period !== null && d.issued_in_previous_period !== undefined && (
            <p className="text-xs text-slate-500 mb-2">
              Previous period ({formatDate(d.previous_range?.from)} – {formatDate(d.previous_range?.to)}): {d.issued_in_previous_period} issued
            </p>
          )}
          {d.issues_by_month?.length > 0 && (
            <p className="text-xs text-slate-600 mb-2">
              By month: {d.issues_by_month.map((m) => `${m.month}: ${m.issued}`).join(' · ')}
            </p>
          )}
          {d.top_categories?.length > 0 && (
            <p className="text-xs text-slate-600">
              Top categories: {d.top_categories.map((c) => `${c.category} (${c.issued})`).join(' · ')}
            </p>
          )}
        </>
      );
    case 'getMemberIssueHistory':
      if (d.ambiguous) {
        return (
          <div className="mb-2 text-sm text-slate-600">
            Several members match:
            <ul className="mt-1 list-disc pl-5">
              {d.candidates.map((c) => (
                <li key={c.member_id}>{c.member_name} <span className="text-slate-400">(ID {c.member_id}, {c.member_type})</span></li>
              ))}
            </ul>
          </div>
        );
      }
      if (!d.found) return <p className="text-sm text-slate-500">No member found.</p>;
      return (
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-700 mb-2">{d.member.member_name} <span className="font-normal text-slate-400">· ID {d.member.member_id}</span></p>
          <div className="grid grid-cols-3 gap-2">
            <Chip label="Total loans" value={d.summary.total_loans} />
            <Chip label="Open" value={d.summary.open_loans} />
            <Chip label="Overdue" value={d.summary.overdue_loans} tone="red" />
          </div>
        </div>
      );
    default:
      return null;
  }
};

function ResultBlock({ result }) {
  const label = TOOL_LABELS[result.tool] || result.tool;

  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span><strong>{label}:</strong> could not be retrieved ({result.error?.message || 'unknown error'}).</span>
      </div>
    );
  }

  const columns = COLUMNS[result.tool];
  const items = itemsOf(result);
  const d = result.data || {};
  const total = d.total ?? d.matches?.total ?? d.total_members_with_pending_returns;
  const truncated = d.truncated || d.matches?.truncated;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {result.as_of && <p className="text-[11px] text-slate-400">as of {new Date(result.as_of).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      <Summary result={result} />

      {columns && items.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {columns.map(([key, heading]) => (
                  <th key={key} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-2 whitespace-nowrap">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((row, i) => (
                <tr key={row.issue_id ?? row.book_id ?? row.member_id ?? i} className="hover:bg-slate-50/60">
                  {columns.map(([key, , fmt]) => (
                    <td key={key} className="px-2 py-2 text-slate-700 align-top">
                      {fmt ? fmt(row[key]) : (row[key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {columns && items.length === 0 && !(result.tool === 'getMemberIssueHistory' && (d.ambiguous || !d.found)) && (
        <p className="text-sm text-slate-500">No matching records.</p>
      )}

      {truncated && total !== undefined && (
        <p className="mt-2 text-xs text-slate-400">Showing {items.length} of {total}. Ask a more specific question to narrow it down.</p>
      )}
    </div>
  );
}

export default function AIResultView({ results = [] }) {
  if (!results.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {results.map((r, i) => <ResultBlock key={`${r.tool}-${i}`} result={r} />)}
    </div>
  );
}
