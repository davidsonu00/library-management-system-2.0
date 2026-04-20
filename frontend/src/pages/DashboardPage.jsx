import { useState, useEffect } from 'react';
import { BookOpenIcon, UserGroupIcon, ExclamationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import StatCard from '../components/ui/StatCard';
import api from '../utils/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/issues/dashboard')
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {};
  const trend = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    Issues: parseInt(t.count)
  }));
  const recentIssues = data?.recentIssues || [];

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Overview of your library operations</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpenIcon}       label="Total Books"      value={loading ? undefined : stats.totalBooks}      color="primary" />
        <StatCard icon={BookOpenIcon}       label="Available Books"  value={loading ? undefined : stats.availableBooks}  color="green" />
        <StatCard icon={UserGroupIcon}      label="Active Members"   value={loading ? undefined : stats.totalMembers}    color="blue" />
        <StatCard icon={ClockIcon}          label="Books Issued"     value={loading ? undefined : stats.totalIssued}     color="amber" />
      </div>

      {/* Overdue alert */}
      {!loading && stats.overdueCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">{stats.overdueCount} Overdue Book{stats.overdueCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-500">These books are past their due date. Fine is accumulating at ₹5/day.</p>
          </div>
          <a href="/records?status=overdue" className="ml-auto text-xs font-medium text-red-600 hover:underline whitespace-nowrap">View →</a>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-bold text-slate-800 mb-4">Monthly Issue Trend</h3>
          {trend.length === 0 && !loading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="issueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Area type="monotone" dataKey="Issues" stroke="#6366f1" strokeWidth={2.5} fill="url(#issueGrad)" dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick stats */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            {[
              { label: 'Utilization Rate', value: stats.totalBooks ? `${Math.round(((stats.totalBooks - (stats.availableBooks || 0)) / stats.totalBooks) * 100)}%` : '0%', color: 'bg-primary-500' },
              { label: 'Overdue Rate', value: stats.totalIssued ? `${Math.round((stats.overdueCount / stats.totalIssued) * 100)}%` : '0%', color: 'bg-red-500' },
              { label: 'Books Returned', value: `${stats.totalBooks || 0}`, color: 'bg-emerald-500' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">{label}</span>
                  <span className="text-slate-700 font-bold">{loading ? '...' : value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: loading ? '0%' : value }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent issues */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-slate-800 mb-4">Recent Activity</h3>
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}</div>
        ) : recentIssues.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentIssues.map(issue => (
              <div key={issue.issue_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <BookOpenIcon className="w-4 h-4 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{issue.book?.title}</p>
                  <p className="text-xs text-slate-400">{issue.member?.name}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(issue.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${issue.return_date ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {issue.return_date ? 'Returned' : 'Issued'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
