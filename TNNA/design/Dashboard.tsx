import React from 'react';
import { BottomNav } from './BottomNav';
import {
  QuickAction,
  MatchCard,
  FormIndicator,
  StatCard,
  ActivityItem,
} from './Cards';
import type {
  FormResult,
  UserProfile,
  MatchCardProps,
  ActivityItemProps,
} from './types';

// ─── Props ──────────────────────────────────────────────
interface DashboardProps {
  user: UserProfile;
  recentForm?: FormResult[];
  upcomingMatches?: MatchCardProps[];
  activities?: ActivityItemProps[];
  onNavigate?: (tab: string) => void;
  onFabPress?: () => void;
  onBookCourt?: () => void;
  onRecordMatch?: () => void;
  onFindPartners?: () => void;
}

// ─── Sample Data ────────────────────────────────────────
const defaultForm: FormResult[] = ['W', 'W', 'L', 'W', '-'];

const defaultMatches: MatchCardProps[] = [
  {
    date: 'Today, 18:30',
    court: 'Court 04 (Indoor)',
    status: 'confirmed',
    teamA: [{ name: 'You' }],
    teamB: [{ name: 'M. Davies' }],
  },
  {
    date: 'Sat, Feb 8 • 10:00',
    court: 'Court 02 (Clay)',
    status: 'pending',
    teamA: [{ name: 'Player 1' }, { name: 'Player 2' }],
    teamB: [{ name: '' }, { name: '' }],
  },
];

const defaultActivities: ActivityItemProps[] = [
  {
    icon: 'emoji_events',
    iconColor: 'text-primary',
    iconBg: 'bg-primary/20',
    title: 'New Tournament Entry',
    description: 'Spring Open 2024 is now open for registration.',
  },
  {
    icon: 'local_offer',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    title: 'Pro Shop Discount',
    description: '20% off on all Wilson rackets this week.',
  },
];

// ─── Component ──────────────────────────────────────────
export const Dashboard: React.FC<DashboardProps> = ({
  user,
  recentForm = defaultForm,
  upcomingMatches = defaultMatches,
  activities = defaultActivities,
  onNavigate,
  onFabPress,
  onBookCourt,
  onRecordMatch,
  onFindPartners,
}) => {
  return (
    <div className="pb-24 bg-background-light dark:bg-background-dark min-h-screen">
      {/* ── Navy Header ─────────────────────────────────── */}
      <header className="px-6 pt-8 pb-6 bg-navy dark:bg-slate-900 rounded-b-[32px] text-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary flex-shrink-0">
              {user.avatarUrl ? (
                <img
                  alt={user.name}
                  className="w-full h-full object-cover"
                  src={user.avatarUrl}
                />
              ) : (
                <div className="w-full h-full bg-slate-600 flex items-center justify-center">
                  <span className="material-icons-round text-2xl">person</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">
                Welcome back,
              </p>
              <h1 className="text-xl font-bold">{user.name}</h1>
            </div>
          </div>

          <button className="relative p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
            <span className="material-icons-round">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-navy" />
          </button>
        </div>

        {/* Skill Badge Bar */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center">
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                Skill Level
              </p>
              <div className="flex items-center gap-1">
                <span className="text-secondary font-bold text-lg">
                  {user.ntrp}
                </span>
                <span className="text-[10px] text-slate-300">NTRP</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                Rank
              </p>
              <p className="text-lg font-bold">#{user.rank}</p>
            </div>
          </div>

          {user.badge && (
            <div className="bg-secondary text-navy px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1">
              <span className="material-icons-round text-sm">
                emoji_events
              </span>
              {user.badge}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="px-6 -mt-4 space-y-8">
        {/* Quick Actions */}
        <section>
          <div className="grid grid-cols-2 gap-4">
            <QuickAction
              icon="sports_tennis"
              title="Book a Court"
              subtitle="Check availability"
              variant="primary"
              onClick={onBookCourt}
            />
            <div className="grid grid-rows-2 gap-4">
              <QuickAction
                icon="history"
                title="Record Match"
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                iconColor="text-blue-600"
                onClick={onRecordMatch}
              />
              <QuickAction
                icon="group"
                title="Find Partners"
                iconBg="bg-orange-100 dark:bg-orange-900/30"
                iconColor="text-orange-600"
                onClick={onFindPartners}
              />
            </div>
          </div>
        </section>

        {/* Upcoming Matches */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold dark:text-white">
              Upcoming Matches
            </h2>
            <button className="text-sm font-semibold text-slate-500 hover:text-navy dark:text-slate-400">
              View All
            </button>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-4 -mx-6 px-6">
            {upcomingMatches.map((match, i) => (
              <MatchCard key={i} {...match} />
            ))}
          </div>
        </section>

        {/* Recent Form + Stats */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold dark:text-white">Recent Form</h2>
            <FormIndicator results={recentForm} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Win Rate" value="72%" />
            <StatCard label="Matches" value="48" />
            <StatCard label="Aces" value="124" />
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <h2 className="text-lg font-bold dark:text-white mb-4">Activity</h2>
          <div className="space-y-3">
            {activities.map((item, i) => (
              <ActivityItem key={i} {...item} />
            ))}
          </div>
        </section>
      </main>

      <BottomNav
        activeTab="home"
        onNavigate={onNavigate}
        onFabPress={onFabPress}
      />
    </div>
  );
};
