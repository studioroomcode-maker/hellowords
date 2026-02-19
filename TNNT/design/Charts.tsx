import React from 'react';
import type { ChartDataPoint, OutcomeData, SkillLevelData } from './types';

// ─── PerformanceChart (월별 막대 차트) ──────────────────
interface PerformanceChartProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  title = 'Performance Trend',
  subtitle = 'Winning ratio by month',
}) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
    <div className="flex justify-between items-center mb-6">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs font-semibold py-1 px-2 focus:ring-0">
        <option>Last 6 Months</option>
        <option>All Time</option>
      </select>
    </div>

    <div className="h-40 flex items-end justify-between px-2 space-x-4">
      {data.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full bg-primary/10 dark:bg-primary/5 rounded-t-lg relative group">
            {/* Tooltip on hover */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {item.value}%
            </div>
            <div
              className={`w-full rounded-t-lg transition-all duration-1000 ${
                item.current ? 'bg-primary' : 'bg-primary/40'
              }`}
              style={{ height: `${item.value}px` }}
            />
          </div>
          <span
            className={`text-[10px] font-semibold ${
              item.current ? 'text-primary font-bold' : 'text-slate-400'
            }`}
          >
            {item.month}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ─── OutcomeDonut (승/패 도넛) ──────────────────────────
export const OutcomeDonut: React.FC<OutcomeData> = ({
  total,
  wins,
  losses,
}) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
      Outcome
    </h4>

    <div className="relative flex justify-center items-center py-4">
      <div
        className="w-24 h-24 rounded-full border-[12px] border-primary flex items-center justify-center"
        style={{
          borderRightColor: '#D4F01E',
          borderBottomColor: '#D4F01E',
        }}
      >
        <div className="text-center">
          <span className="block text-xl font-black">{total}</span>
          <span className="text-[8px] text-slate-400">TOTAL</span>
        </div>
      </div>
    </div>

    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[10px] font-medium">Win</span>
        </div>
        <span className="text-[10px] font-bold">{wins}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary" />
          <span className="text-[10px] font-medium">Loss</span>
        </div>
        <span className="text-[10px] font-bold">{losses}</span>
      </div>
    </div>
  </div>
);

// ─── SkillLevel (레벨 프로그레스) ────────────────────────
export const SkillLevel: React.FC<SkillLevelData> = ({
  level,
  trend,
  progress,
  pointsToNext,
}) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
      Skill level
    </h4>

    <div className="space-y-4">
      <div className="flex justify-center flex-col items-center">
        <div className="text-3xl font-black text-slate-900 dark:text-white">
          {level.toFixed(2)}
        </div>
        <div className="text-[10px] text-emerald-500 font-bold flex items-center">
          <span className="material-icons-round text-sm">trending_up</span>
          &nbsp;{trend.toFixed(2)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <span>Level Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-primary rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[9px] text-slate-400 text-center mt-2">
          {pointsToNext} pts until next level
        </p>
      </div>
    </div>
  </div>
);
