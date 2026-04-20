import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpenIcon, EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back! 👋');
      navigate('/');
    } catch (err) {
      // Error handled by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full bg-white"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: Math.random() * 0.5 + 0.2 }}
            />
          ))}
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
            <BookOpenIcon className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-white text-xl">LibraryOS</span>
        </div>
        <div className="relative z-10">
          <h1 className="font-display font-bold text-4xl text-white leading-snug mb-4">
            Your Library,<br />Fully Managed.
          </h1>
          <p className="text-primary-200 text-base leading-relaxed max-w-sm">
            Enterprise-grade library automation for modern institutions. Manage collections, members, loans and returns securely from a single dashboard.
          </p>
          <div className="mt-8 flex gap-4">
            {[['📚', 'Catalog Control'], ['👥', 'Secure Access'], ['⚡', 'Streamlined Ops']].map(([emoji, label]) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
                <div className="text-xl mb-1">{emoji}</div>
                <p className="text-white text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-primary-400 text-xs">© 2025 LibraryOS · All rights reserved</p>
      </div>

      {/* Right - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <BookOpenIcon className="w-7 h-7 text-primary-400" />
            <span className="font-display font-bold text-white text-xl">LibraryOS</span>
          </div>

          <div className="mb-8">
            <div className="w-12 h-12 bg-primary-600/20 rounded-2xl flex items-center justify-center mb-5">
              <LockClosedIcon className="w-6 h-6 text-primary-400" />
            </div>
            <h2 className="font-display font-bold text-3xl text-white mb-2">Administrator Access</h2>
            <p className="text-slate-400 text-sm">Enter your credentials to securely access LibraryOS.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1">
                  {showPw ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary-900/30 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
          {/* <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-xs text-slate-500 font-medium mb-1">Default credentials:</p>
            <p className="text-xs text-slate-400 font-mono">admin@library.com / Admin@123</p>
          </div> */}
        </div>
      </div>
    </div>
  );
}
