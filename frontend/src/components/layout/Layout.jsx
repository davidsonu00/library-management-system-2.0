import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpenIcon, HomeIcon, UserGroupIcon, ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon, DocumentTextIcon, Bars3Icon, XMarkIcon,
  BookmarkSquareIcon, BellIcon
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard', end: true },
  { to: '/books', icon: BookOpenIcon, label: 'Books' },
  { to: '/members', icon: UserGroupIcon, label: 'Members' },
  { to: '/issue', icon: BookmarkSquareIcon, label: 'Issue Book' },
  { to: '/records', icon: ClipboardDocumentListIcon, label: 'Records' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-slate-900 text-white
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-900/30">
            <BookOpenIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white leading-tight">LibraryOS</p>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</p>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Admin info */}
        <div className="p-4 border-t border-slate-700/60">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {admin?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{admin?.name}</p>
              <p className="text-xs text-slate-400 truncate">{admin?.role}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700 p-1"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button className="relative text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <BellIcon className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800">{admin?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{admin?.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {admin?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
