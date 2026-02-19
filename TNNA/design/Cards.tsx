import React from 'react';
import type {
  QuickActionProps,
  MatchCardProps,
  StatCardProps,
  ActivityItemProps,
  RivalCardProps,
  CourtPerformanceProps,
  FormResult,
} from './types';

// ─── QuickAction ────────────────────────────────────────
export const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  title,
  subtitle,
  variant = 'default',
  iconBg = 'bg-blue-100 dark:bg-blue-900/30',
  iconColor = 'text-blue-600',
  onClick,
}) => {
  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-start p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
      >
        <span className="material-icons-round text-3xl mb-3">{icon}</span>
        <span className="font-bold text-sm">{title}</span>
        {subtitle && <span className="text-[10px] opacity-70">{subtitle}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm active:scale-95 transition-transform w-full"
    >
      <div
        className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}
      >
        <span className={`material-icons-round ${iconColor} text-lg`}>
          {icon}
        </span>
      </div>
      <span className="text-xs font-bold dark:text-white">{title}</span>
    </button>
  );
};

// ─── MatchCard ──────────────────────────────────────────
const statusStyles = {
  confirmed:
    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  pending:
    'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

export const MatchCard: React.FC<MatchCardProps> = ({
  date,
  court,
  status,
  teamA,
  teamB,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="min-w-[280px] bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 font-bold uppercase">
          {date}
        </span>
        <span className="text-sm font-bold dark:text-white">{court}</span>
      </div>
      <div
        className={`px-2 py-1 ${statusStyles[status]} text-[10px] font-bold rounded uppercase`}
      >
        {status}
      </div>
    </div>

    <div className="flex items-center justify-between">
      {/* Team A */}
      <div className="flex -space-x-3">
        {teamA.map((p, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 overflow-hidden"
          >
            {p.avatarUrl ? (
              <img
                alt={p.name}
                src={p.avatarUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <span className="material-icons-round text-sm">person</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <span className="text-xs font-black text-slate-300">VS</span>

      {/* Team B */}
      <div className="flex -space-x-3">
        {teamB.map((p, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 overflow-hidden"
          >
            {p.avatarUrl ? (
              <img
                alt={p.name}
                src={p.avatarUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <span className="material-icons-round text-sm">
                  person_add
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── FormIndicator (W/L/- 뱃지) ────────────────────────
const formColorMap: Record<FormResult, string> = {
  W: 'bg-green-500 text-white',
  L: 'bg-red-500 text-white',
  '-': 'bg-slate-200 dark:bg-slate-700 text-slate-400',
};

export const FormIndicator: React.FC<{ results: FormResult[] }> = ({
  results,
}) => (
  <div className="flex gap-1">
    {results.map((r, i) => (
      <div
        key={i}
        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${formColorMap[r]}`}
      >
        {r}
      </div>
    ))}
  </div>
);

// ─── StatCard ───────────────────────────────────────────
const valueColor = {
  default: 'text-navy dark:text-white',
  primary: 'text-primary',
  accent: 'text-secondary',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  progress,
  trend,
  variant = 'default',
}) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
      {label}
    </p>
    <p className={`text-xl font-black ${valueColor[variant]}`}>{value}</p>
    {progress !== undefined && (
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    )}
    {trend && (
      <p className="text-[10px] text-emerald-500 font-medium mt-1">{trend}</p>
    )}
  </div>
);

// ─── ActivityItem ───────────────────────────────────────
export const ActivityItem: React.FC<ActivityItemProps> = ({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-shadow"
  >
    <div
      className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center ${iconColor}`}
    >
      <span className="material-icons-round">{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold dark:text-white truncate">{title}</p>
      <p className="text-xs text-slate-400 truncate">{description}</p>
    </div>
    <span className="material-icons-round text-slate-300 flex-shrink-0">
      chevron_right
    </span>
  </div>
);

// ─── RivalCard ──────────────────────────────────────────
export const RivalCard: React.FC<RivalCardProps> = ({
  name,
  role,
  record,
  status,
  statusColor = 'text-emerald-500',
  onClick,
}) => (
  <div
    onClick={onClick}
    className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800 cursor-pointer hover:shadow-sm transition-shadow"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="material-icons-round text-slate-400">person</span>
      </div>
      <div>
        <p className="text-sm font-bold">{name}</p>
        <p className="text-[10px] text-slate-500">{role}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-xs font-black">{record}</p>
      <p
        className={`text-[9px] ${statusColor} font-bold uppercase tracking-tighter`}
      >
        {status}
      </p>
    </div>
  </div>
);

// ─── CourtPerformance ───────────────────────────────────
export const CourtPerformance: React.FC<CourtPerformanceProps> = ({
  courtType,
  winRate,
  barColor,
}) => (
  <div>
    <div className="flex justify-between text-xs mb-1.5">
      <span className="font-medium text-slate-600 dark:text-slate-400">
        {courtType}
      </span>
      <span className="font-bold">{winRate}% Win</span>
    </div>
    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${barColor} rounded-full transition-all duration-700`}
        style={{ width: `${winRate}%` }}
      />
    </div>
  </div>
);
