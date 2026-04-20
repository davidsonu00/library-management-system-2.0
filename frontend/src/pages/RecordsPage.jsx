import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, ArrowUturnLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';

export default function RecordsPage() {
  const [issues, setIssues] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returning, setReturning] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, search, status: statusFilter };
      const { data } = await api.get('/api/issues', { params });
      setIssues(data.data.issues);
      setPagination(data.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleReturn = async () => {
    if (!returnTarget) return;
    setReturning(true);
    try {
      const { data } = await api.put(`/api/issues/${returnTarget.issue_id}/return`);
      const fine = data.data.fine_amount;
      toast.success(`Book returned! ${fine > 0 ? `Fine: ₹${fine}` : 'No fine.'}`);
      setReturnTarget(null);
      fetchIssues();
    } catch {} finally { setReturning(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const columns = [
    { key: 'issue_id', label: '#', render: v => <span className="font-mono text-xs text-slate-400">#{v}</span> },
    { key: 'book', label: 'Book', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-800 max-w-[160px] truncate">{v?.title}</p>
        <p className="text-xs text-slate-400">{v?.author}</p>
      </div>
    )},
    { key: 'member', label: 'Member', render: (v) => (
      <div>
        <p className="font-medium text-slate-700">{v?.name}</p>
        <p className="text-xs text-slate-400">{v?.phone || v?.email}</p>
      </div>
    )},
    { key: 'issue_date', label: 'Issued', render: v => fmtDate(v) },
    { key: 'due_date', label: 'Due', render: (v, row) => (
      <span className={`text-sm ${!row.return_date && new Date(v) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
        {fmtDate(v)}
      </span>
    )},
    { key: 'return_date', label: 'Returned', render: v => v ? <span className="text-emerald-600 text-sm">{fmtDate(v)}</span> : '—' },
    { key: 'fine_amount', label: 'Fine', render: (v, row) => {
      const fine = row.return_date ? parseFloat(v || 0) : parseFloat(row.current_fine || 0);
      return fine > 0 ? <span className="text-red-600 font-semibold text-sm">₹{fine.toFixed(0)}</span> : <span className="text-slate-400 text-sm">₹0</span>;
    }},
    { key: 'status', label: 'Status', render: (v, row) => {
      if (row.return_date) return <span className="badge-green">Returned</span>;
      if (row.is_overdue) return <span className="badge-red">Overdue</span>;
      return <span className="badge-amber">Issued</span>;
    }},
    { key: 'actions', label: '', render: (_, row) => !row.return_date ? (
      <button
        onClick={() => setReturnTarget(row)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
      >
        <ArrowUturnLeftIcon className="w-3 h-3" /> Return
      </button>
    ) : null }
  ];

  // CSV export
  const exportCSV = () => {
    const headers = ['Issue ID', 'Book', 'Author', 'Member', 'Issue Date', 'Due Date', 'Return Date', 'Fine'];
    const rows = issues.map(i => [
      i.issue_id, i.book?.title, i.book?.author, i.member?.name,
      fmtDate(i.issue_date), fmtDate(i.due_date), fmtDate(i.return_date),
      `₹${i.return_date ? i.fine_amount : (i.current_fine || 0)}`
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'issue-records.csv'; a.click();
    toast.success('CSV exported!');
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800">Issue Records</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full borrowing history and returns</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary text-xs">⬇ Export CSV</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by member name..." className="input pl-9" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto min-w-[140px]">
          <option value="">All Status</option>
          <option value="issued">Currently Issued</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="card p-5">
        <Table columns={columns} data={issues} loading={loading} emptyMessage="No records found." />
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Return confirm modal */}
      <Modal isOpen={!!returnTarget} onClose={() => setReturnTarget(null)} title="Return Book" size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Confirm Return</p>
              <p>Book: <strong>{returnTarget?.book?.title}</strong></p>
              <p>Member: <strong>{returnTarget?.member?.name}</strong></p>
            </div>
          </div>

          {returnTarget?.is_overdue && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <p className="font-semibold mb-1">⚠ Overdue Fine</p>
              <p>Estimated fine: <strong>₹{returnTarget?.current_fine?.toFixed(0)}</strong> (₹5/day)</p>
              <p className="text-xs mt-1 text-red-500">Due: {returnTarget?.due_date ? new Date(returnTarget.due_date).toLocaleDateString('en-IN') : '—'}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => setReturnTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleReturn} disabled={returning} className="btn-success">
              {returning ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
