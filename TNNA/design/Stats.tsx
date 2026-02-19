import React from 'react';
import { BottomNav } from './BottomNav';
import { StatCard, RivalCard, CourtPerformance } from './Cards';
import { PerformanceChart, OutcomeDonut, SkillLevel } from './Charts';
import type {
  UserProfile,
  ChartDataPoint,
  RivalCardProps,
  CourtPerformanceProps,
} from './types';

// ─── Props ──────────────────────────────────────────────
interface StatsProps {
  player: UserProfile;
  chartData?: ChartDataPoint[];
  rivals?: RivalCardProps[];
  courts?: CourtPerformanceProps[];
  onBack?: () => void;
  onNavigate?: (tab: string) => void;
  onFabPress?: () => void;
  onSharePress?: () => void;
}

// ─── Sample Data ────────────────────────────────────────
const defaultChartData: ChartDataPoint[] = [
  { month: 'OCT', value: 55 },
  { month: 'NOV', value: 70 },
  { month: 'DEC', value: 45 },
  { month: 'JAN', value: 85 },
  { month: 'FEB', value: 65, current: true },
];

const defaultRivals: RivalCardProps[] = [
  {
    name: 'Jun-ho Lee',
    role: 'Most frequent rival',
    record: '6 - 4',
    status: 'Dominating',
    statusColor: 'text-emerald-500',
  },
  {
    name: 'Seo-yeon Park',
    role: 'Doubles partner',
    record: '12 - 2',
    status: 'Strong Duo',
    statusColor: 'text-primary',
  },
];

const defaultCourts: CourtPerformanceProps[] = [
  { courtType: 'Hard Court', winRate: 75, barColor: 'bg-blue-400' },
  { courtType: 'Clay Court', winRate: 42, barColor: 'bg-orange-400' },
  { courtType: 'Grass Court', winRate: 60, barColor: 'bg-emerald-400' },
];

// ─── Component ──────────────────────────────────────────
export const Stats: React.FC<StatsProps> = ({
  player,
  chartData = defaultChartData,
  rivals = defaultRivals,
  courts = defaultCourts,
  onBack,
  onNavigate,
  onFabPress,
  onSharePress,
}) => {
  return (
    <div className="pb-24 bg-background-light dark:bg-background-dark min-h-screen">
      {/* ── Sticky Top Nav ──────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <span className="material-icons-round text-slate-600 dark:text-slate-400">
            arrow_back_ios_new
          </span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">Player Analytics</h1>
        <button
          onClick={onSharePress}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <span className="material-icons-round text-slate-600 dark:text-slate-400">
            share
          </span>
        </button>
      </nav>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {/* ── Player Profile ────────────────────────────── */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
              {player.avatarUrl ? (
                <img
                  alt={player.name}
                  className="w-full h-full object-cover"
                  src={player.avatarUrl}
                />
              ) : (
                <span className="material-icons-round text-5xl text-slate-400 dark:text-slate-500">
                  account_circle
                </span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-secondary text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white dark:border-slate-800">
              LVL {player.ntrp}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {player.name}
              {player.verified && (
                <span className="material-icons-round text-primary text-base">
                  verified
                </span>
              )}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm truncate">
              {player.club} • Joined {player.joinDate}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 text-xs font-semibold rounded-md">
                Ranked #{player.rank}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-md">
                NTRP {player.ntrp}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI Stats ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Win Rate"
            value="68%"
            progress={68}
            variant="primary"
          />
          <StatCard label="Matches" value="124" trend="+12 this month" />
          <StatCard label="Current" value="3W" variant="accent" />
        </div>

        {/* ── Performance Chart ─────────────────────────── */}
        <PerformanceChart data={chartData} />

        {/* ── Outcome + Skill Level ─────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <OutcomeDonut total={124} wins={84} losses={40} />
          <SkillLevel
            level={4.52}
            trend={0.12}
            progress={82}
            pointsToNext={124}
          />
        </div>

        {/* ── Rivals & Partners ─────────────────────────── */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Rivals & Partners
            </h3>
            <button className="text-xs text-primary font-bold">View All</button>
          </div>
          <div className="space-y-3">
            {rivals.map((rival, i) => (
              <RivalCard key={i} {...rival} />
            ))}
          </div>
        </div>

        {/* ── Court Performance ─────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
          <h3 className="font-bold mb-4">Court Performance</h3>
          <div className="space-y-4">
            {courts.map((court, i) => (
              <CourtPerformance key={i} {...court} />
            ))}
          </div>
        </div>
      </main>

      <BottomNav
        activeTab="stats"
        onNavigate={onNavigate}
        onFabPress={onFabPress}
      />
    </div>
  );
};
