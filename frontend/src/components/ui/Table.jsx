import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export function Table({ columns, data, loading, emptyMessage = 'No records found' }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" style={{borderWidth:'3px'}} />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );

  if (!data || data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm">{emptyMessage}</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th key={col.key} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 first:pl-0 last:pr-0 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/70 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3.5 first:pl-0 last:pr-0 text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
      <p className="text-xs text-slate-400">Showing {start}–{end} of {total} records</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
              p === page ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
