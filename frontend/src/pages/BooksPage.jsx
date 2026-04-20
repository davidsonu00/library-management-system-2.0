import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import { Table, Pagination } from '../components/ui/Table';

const EMPTY_FORM = { title: '', author: '', isbn: '', category: '', publisher: '', publish_year: '', total_copies: 1, shelf_location: '', description: '' };

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ open: false, mode: 'add', book: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, search, category: categoryFilter, availability: availFilter };
      const { data } = await api.get('/books', { params });
      setBooks(data.data.books);
      setPagination(data.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [page, search, categoryFilter, availFilter]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  useEffect(() => {
    api.get('/books/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const openAdd = () => { setForm(EMPTY_FORM); setModal({ open: true, mode: 'add', book: null }); };
  const openEdit = (book) => {
    setForm({ title: book.title, author: book.author, isbn: book.isbn || '', category: book.category || '', publisher: book.publisher || '', publish_year: book.publish_year || '', total_copies: book.total_copies, shelf_location: book.shelf_location || '', description: book.description || '' });
    setModal({ open: true, mode: 'edit', book });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/api/books', form);
        toast.success('Book added successfully!');
      } else {
        await api.put(`/books/${modal.book.book_id}`, form);
        toast.success('Book updated!');
      }
      setModal({ open: false });
      fetchBooks();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/books/${deleteTarget.book_id}`);
      toast.success('Book deleted');
      setDeleteTarget(null);
      fetchBooks();
    } catch {}
  };

  const columns = [
    { key: 'title', label: 'Title', render: (v, row) => (
      <div>
        <p className="font-medium text-slate-800 truncate max-w-[180px]">{v}</p>
        <p className="text-xs text-slate-400">{row.author}</p>
      </div>
    )},
    { key: 'isbn', label: 'ISBN' },
    { key: 'category', label: 'Category', render: v => v ? <span className="badge-blue">{v}</span> : '—' },
    { key: 'total_copies', label: 'Total' },
    { key: 'available_copies', label: 'Available', render: (v, row) => (
      <span className={v > 0 ? 'badge-green' : 'badge-red'}>
        {v}/{row.total_copies}
      </span>
    )},
    { key: 'shelf_location', label: 'Shelf' },
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
          <h1 className="font-display font-bold text-2xl text-slate-800">Books</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your library collection</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon className="w-4 h-4" />Add Book</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, author, ISBN..." className="input pl-9" />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className="input w-auto min-w-[140px]">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={availFilter} onChange={e => { setAvailFilter(e.target.value); setPage(1); }} className="input w-auto min-w-[140px]">
          <option value="">All Availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-5">
        <Table columns={columns} data={books} loading={loading} emptyMessage="No books found. Add some!" />
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modal.open} onClose={() => setModal({ open: false })} title={modal.mode === 'add' ? 'Add New Book' : 'Edit Book'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" />
            </div>
            <div>
              <label className="label">Author *</label>
              <input className="input" required value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name" />
            </div>
            <div>
              <label className="label">ISBN</label>
              <input className="input" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} placeholder="ISBN number" />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} list="category-list" placeholder="e.g. Programming" />
              <datalist id="category-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="label">Publisher</label>
              <input className="input" value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} placeholder="Publisher" />
            </div>
            <div>
              <label className="label">Publish Year</label>
              <input type="number" className="input" value={form.publish_year} onChange={e => setForm(f => ({ ...f, publish_year: e.target.value }))} placeholder="e.g. 2023" min="1800" max={new Date().getFullYear()} />
            </div>
            <div>
              <label className="label">Total Copies *</label>
              <input type="number" className="input" required min="1" value={form.total_copies} onChange={e => setForm(f => ({ ...f, total_copies: e.target.value }))} />
            </div>
            <div>
              <label className="label">Shelf Location</label>
              <input className="input" value={form.shelf_location} onChange={e => setForm(f => ({ ...f, shelf_location: e.target.value }))} placeholder="e.g. A-12" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal({ open: false })} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Book' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Book" size="sm">
        <p className="text-slate-600 text-sm">Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
