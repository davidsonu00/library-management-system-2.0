import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, BookmarkSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function IssuePage() {
  const [step, setStep] = useState(1);
  const [memberSearch, setMemberSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [loanDays, setLoanDays] = useState(14);
  const [issuing, setIssuing] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (memberSearch.length < 2) { setMembers([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/members', { params: { search: memberSearch, limit: 6 } });
        setMembers(data.data.members);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  useEffect(() => {
    if (bookSearch.length < 2) { setBooks([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/books', { params: { search: bookSearch, availability: 'available', limit: 6 } });
        setBooks(data.data.books);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [bookSearch]);

  const issueDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueDate = new Date(Date.now() + loanDays * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleIssue = async () => {
    if (!selectedMember || !selectedBook) return;
    setIssuing(true);
    try {
      const { data } = await api.post('/api/issues', {
        member_id: selectedMember.member_id,
        book_id: selectedBook.book_id,
        loan_days: loanDays
      });
      setSuccess(data.data);
      toast.success('Book issued successfully!');
    } catch {} finally { setIssuing(false); }
  };

  const reset = () => {
    setStep(1); setSelectedMember(null); setSelectedBook(null);
    setMemberSearch(''); setBookSearch(''); setSuccess(null); setLoanDays(14);
  };

  if (success) return (
    <div className="max-w-lg mx-auto mt-10 animate-slide-up">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-9 h-9 text-emerald-600" />
        </div>
        <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Book Issued!</h2>
        <p className="text-slate-500 text-sm mb-6">Issue #{success.issue_id} created successfully</p>
        <div className="bg-slate-50 rounded-xl p-5 text-left space-y-3 mb-6">
          {[
            ['Book', success.book?.title],
            ['Member', success.member?.name],
            ['Issue Date', new Date(success.issue_date).toLocaleDateString('en-IN')],
            ['Due Date', new Date(success.due_date).toLocaleDateString('en-IN')],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-800">{val}</span>
            </div>
          ))}
        </div>
        <button onClick={reset} className="btn-primary w-full justify-center">Issue Another Book</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-slate-800">Issue Book</h1>
        <p className="text-slate-500 text-sm mt-0.5">Assign a book to a library member</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['Select Member', 'Select Book', 'Confirm'].map((label, i) => {
          const s = i + 1;
          const active = step === s;
          const done = step > s;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {done ? '✓' : s}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
              {i < 2 && <div className="flex-1 h-px bg-slate-200 ml-2" />}
            </div>
          );
        })}
      </div>

      <div className="card p-6 space-y-6">
        {/* Step 1: Member */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${selectedMember ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>1</span>
            <label className="font-semibold text-slate-700 text-sm">Select Member</label>
          </div>
          {selectedMember ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="w-9 h-9 bg-emerald-200 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                {selectedMember.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-800 text-sm">{selectedMember.name}</p>
                <p className="text-xs text-slate-500">{selectedMember.email} · {selectedMember.phone || 'No phone'}</p>
              </div>
              <button onClick={() => { setSelectedMember(null); setStep(1); }} className="text-xs text-slate-400 hover:text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search by name, email or phone..."
                autoFocus
              />
              {members.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 overflow-hidden">
                  {members.map(m => (
                    <button key={m.member_id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setMembers([]); setStep(2); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors">
                      <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.email}</p>
                      </div>
                      <span className="ml-auto badge-slate capitalize">{m.member_type}</span>
                    </button>
                  ))}
                </div>
              )}
              {memberSearch.length >= 2 && members.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-slate-400">
                  No members found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Book */}
        <div className={step < 2 ? 'opacity-40 pointer-events-none' : ''}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${selectedBook ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>2</span>
            <label className="font-semibold text-slate-700 text-sm">Select Book</label>
          </div>
          {selectedBook ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookmarkSquareIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-800 text-sm">{selectedBook.title}</p>
                <p className="text-xs text-slate-500">{selectedBook.author} · {selectedBook.available_copies} copies available</p>
              </div>
              <button onClick={() => { setSelectedBook(null); setStep(2); }} className="text-xs text-slate-400 hover:text-red-500">Change</button>
            </div>
          ) : (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9"
                value={bookSearch}
                onChange={e => setBookSearch(e.target.value)}
                placeholder="Search available books by title or author..."
              />
              {books.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 overflow-hidden">
                  {books.map(b => (
                    <button key={b.book_id} onClick={() => { setSelectedBook(b); setBookSearch(''); setBooks([]); setStep(3); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookmarkSquareIcon className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{b.title}</p>
                        <p className="text-xs text-slate-400">{b.author} · {b.category}</p>
                      </div>
                      <span className="badge-green">{b.available_copies} avail.</span>
                    </button>
                  ))}
                </div>
              )}
              {bookSearch.length >= 2 && books.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 px-4 py-3 text-sm text-slate-400">
                  No available books found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Confirm */}
        <div className={step < 3 ? 'opacity-40 pointer-events-none' : ''}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center bg-slate-100 text-slate-500">3</span>
            <label className="font-semibold text-slate-700 text-sm">Loan Duration & Confirm</label>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Loan Period</label>
              <select className="input" value={loanDays} onChange={e => setLoanDays(Number(e.target.value))}>
                <option value={7}>7 days (1 week)</option>
                <option value={14}>14 days (2 weeks)</option>
                <option value={21}>21 days (3 weeks)</option>
                <option value={30}>30 days (1 month)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-1">Issue Date</p>
                <p className="text-sm font-semibold text-slate-800">{issueDate}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-600 mb-1">Due Date</p>
                <p className="text-sm font-semibold text-slate-800">{dueDate}</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <strong>Fine policy:</strong> ₹5 per day after due date. Late return fine will be calculated automatically.
            </div>
            <button
              onClick={handleIssue}
              disabled={issuing || !selectedMember || !selectedBook}
              className="btn-primary w-full justify-center py-2.5"
            >
              {issuing ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Issuing...</span>
              ) : 'Confirm & Issue Book'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
