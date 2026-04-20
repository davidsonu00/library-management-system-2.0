import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', member_type: 'general' };

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'add', member: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/members', { params: { page, limit: 10, search } });
      setMembers(data.data.members);
      setPagination(data.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openAdd = () => { setForm(EMPTY_FORM); setModal({ open: true, mode: 'add' }); };
  const openEdit = (m) => {
    setForm({ name: m.name, email: m.email, phone: m.phone || '', address: m.address || '', member_type: m.member_type });
    setModal({ open: true, mode: 'edit', member: m });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/api/members', form);
        toast.success('Member added!');
      } else {
        await api.put(`/api/members/${modal.member.member_id}`, form);
        toast.success('Member updated!');
      }
      setModal({ open: false });
      fetchMembers();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/members/${deleteTarget.member_id}`);
      toast.success('Member removed');
      setDeleteTarget(null);
      fetchMembers();
    } catch {}
  };

  const typeColors = { student: 'badge-blue', faculty: 'badge-amber', general: 'badge-slate' };

  const columns = [
    { key: 'name', label: 'Member', render: (v, row) => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
          {v?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-slate-800">{v}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'phone', label: 'Phone' },
    { key: 'member_type', label: 'Type', render: v => <span className={typeColors[v] || 'badge-slate'}>{v}</span> },
    { key: 'join_date', label: 'Joined', render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => openEdit(row)} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
        <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
      </div>
    )}
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800">Members</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage library borrowers</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon className="w-4 h-4" />Add Member</button>
      </div>

      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, phone..." className="input pl-9" />
        </div>
      </div>

      <div className="card p-5">
        <Table columns={columns} data={members} loading={loading} emptyMessage="No members yet." />
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false })} title={modal.mode === 'add' ? 'Add New Member' : 'Edit Member'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Member name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit number" />
            </div>
            <div>
              <label className="label">Member Type</label>
              <select className="input" value={form.member_type} onChange={e => setForm(f => ({ ...f, member_type: e.target.value }))}>
                <option value="general">General</option>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input resize-none" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional address" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal({ open: false })} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : modal.mode === 'add' ? 'Add Member' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Member" size="sm">
        <p className="text-slate-600 text-sm">Remove <strong>{deleteTarget?.name}</strong> from the library? They must have no active book issues.</p>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Remove</button>
        </div>
      </Modal>
    </div>
  );
}
