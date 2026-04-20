export default function StatCard({ icon: Icon, label, value, color = 'primary', trend, subtext }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    green:   'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    red:     'bg-red-50 text-red-600',
    blue:    'bg-blue-50 text-blue-600',
  };

  return (
    <div className="card p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-display font-bold text-slate-800">
          {value ?? <span className="w-12 h-7 bg-slate-100 rounded animate-pulse inline-block" />}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
