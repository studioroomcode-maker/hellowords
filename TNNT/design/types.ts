// === Design Reference Types ===
// Google Stitch 디자인 기반 TypeScript 인터페이스

export interface NavTab {
  id: string;
  icon: string;
  label: string;
}

export interface UserProfile {
  name: string;
  avatarUrl?: string;
  club?: string;
  joinDate?: string;
  rank?: number;
  ntrp?: number;
  verified?: boolean;
  badge?: string;
}

export interface QuickActionProps {
  icon: string;
  title: string;
  subtitle?: string;
  variant?: 'primary' | 'default';
  iconBg?: string;
  iconColor?: string;
  onClick?: () => void;
}

export interface MatchPlayer {
  name: string;
  avatarUrl?: string;
}

export interface MatchCardProps {
  date: string;
  court: string;
  status: 'confirmed' | 'pending';
  teamA: MatchPlayer[];
  teamB: MatchPlayer[];
  onClick?: () => void;
}

export type FormResult = 'W' | 'L' | '-';

export interface StatCardProps {
  label: string;
  value: string | number;
  progress?: number;
  trend?: string;
  variant?: 'default' | 'primary' | 'accent';
}

export interface ActivityItemProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  onClick?: () => void;
}

export interface RivalCardProps {
  name: string;
  avatarUrl?: string;
  role: string;
  record: string;
  status: string;
  statusColor?: string;
  onClick?: () => void;
}

export interface CourtPerformanceProps {
  courtType: string;
  winRate: number;
  barColor: string;
}

export interface ChartDataPoint {
  month: string;
  value: number;
  current?: boolean;
}

export interface OutcomeData {
  total: number;
  wins: number;
  losses: number;
}

export interface SkillLevelData {
  level: number;
  trend: number;
  progress: number;
  pointsToNext: number;
}
