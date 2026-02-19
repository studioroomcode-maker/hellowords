import { Session, PlayerStats, Match } from '../types';
import { calcResult } from './scoring';
import { WIN_POINT as WP, DRAW_POINT as DP, LOSE_POINT as LP } from './constants';

// Helper to check if player is a guest
function isGuest(name: string): boolean {
  return name.startsWith('G') || name.startsWith('게스트_') || name.includes('게스트');
}

// Opponent stats interface
export interface OpponentStats {
  opponent: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

// Monthly bests interface
export interface MonthlyBests {
  // 선수별 BEST
  mvp: { name: string; points: number; attendance: number; scoreDiff: number } | null;
  scoreDiffKing: { name: string; avgFor: number; avgAgainst: number; avgDiff: number } | null;
  peacemaker: { name: string; draws: number } | null; // 평화주의자
  friendshipKing: { names: string[]; count: number } | null; // 우정왕 (파트너왕)
  attendanceKing: { names: string[]; days: number } | null; // 출석왕
  winStreakKing: { name: string; streak: number } | null; // 연승왕
  bakeryKing: { name: string; count: number } | null; // 제빵왕 (0점 승리)

  // 카테고리별 BEST
  categoryBests: {
    hand: { value: string; winRate: number; games: number } | null;
    racket: { value: string; winRate: number; games: number } | null;
    ageGroup: { value: string; winRate: number; games: number } | null;
    gender: { value: string; winRate: number; games: number } | null;
    mbti: { value: string; winRate: number; games: number } | null;
  };
}

// Side/position stats interface
export interface SideStats {
  deuce: { games: number; wins: number; draws: number; losses: number; winRate: number };
  ad: { games: number; wins: number; draws: number; losses: number; winRate: number };
}

// Attendance info
export interface AttendanceInfo {
  [playerName: string]: number; // number of unique days
}

// Aggregate stats across multiple sessions
export function aggregateStats(
  sessions: Record<string, Session>,
  memberSet?: Set<string>
): Record<string, PlayerStats> {
  const stats: Record<string, PlayerStats> = {};

  const isValidMember = (name: string): boolean => {
    if (!name || name === '게스트') return false;
    if (memberSet && !memberSet.has(name)) return false;
    return true;
  };

  const ensureStats = (name: string) => {
    if (!stats[name]) {
      stats[name] = {
        name,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        winRate: 0,
      };
    }
  };

  for (const [date, session] of Object.entries(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const result = session.results[String(idx + 1)];
      const matchResult = calcResult(result?.t1, result?.t2);
      if (matchResult === null) continue;

      const validPlayers = [...match.team1, ...match.team2].filter(isValidMember);

      for (const player of validPlayers) {
        ensureStats(player);
        stats[player].games++;
      }

      const s1 = result?.t1 ?? 0;
      const s2 = result?.t2 ?? 0;

      for (const player of match.team1.filter(isValidMember)) {
        ensureStats(player);
        stats[player].scoreFor += s1;
        stats[player].scoreAgainst += s2;
      }

      for (const player of match.team2.filter(isValidMember)) {
        ensureStats(player);
        stats[player].scoreFor += s2;
        stats[player].scoreAgainst += s1;
      }

      if (matchResult === 'W') {
        for (const player of match.team1.filter(isValidMember)) {
          stats[player].wins++;
          stats[player].points += WP;
        }
        for (const player of match.team2.filter(isValidMember)) {
          stats[player].losses++;
          stats[player].points += LP;
        }
      } else if (matchResult === 'L') {
        for (const player of match.team2.filter(isValidMember)) {
          stats[player].wins++;
          stats[player].points += WP;
        }
        for (const player of match.team1.filter(isValidMember)) {
          stats[player].losses++;
          stats[player].points += LP;
        }
      } else {
        for (const player of validPlayers) {
          stats[player].draws++;
          stats[player].points += DP;
        }
      }
    }
  }

  // Calculate win rates
  for (const name in stats) {
    const s = stats[name];
    if (s.games > 0) {
      s.winRate = s.wins / s.games;
    }
  }

  return stats;
}

// Get rankings by points
export function getRankingByPoints(
  stats: Record<string, PlayerStats>,
  minGames: number = 0
): PlayerStats[] {
  return Object.values(stats)
    .filter((s) => s.games >= minGames)
    .sort((a, b) => {
      // Points first
      if (b.points !== a.points) return b.points - a.points;
      // Then win rate
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      // Then score difference
      const diffA = a.scoreFor - a.scoreAgainst;
      const diffB = b.scoreFor - b.scoreAgainst;
      return diffB - diffA;
    });
}

// Get rankings by win rate
export function getRankingByWinRate(
  stats: Record<string, PlayerStats>,
  minGames: number = 3
): PlayerStats[] {
  return Object.values(stats)
    .filter((s) => s.games >= minGames)
    .sort((a, b) => {
      // Win rate first
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      // Then more games is better
      if (b.games !== a.games) return b.games - a.games;
      // Then score difference
      const diffA = a.scoreFor - a.scoreAgainst;
      const diffB = b.scoreFor - b.scoreAgainst;
      return diffB - diffA;
    });
}

// Get rankings by score difference
export function getRankingByScoreDiff(
  stats: Record<string, PlayerStats>,
  minGames: number = 0
): PlayerStats[] {
  return Object.values(stats)
    .filter((s) => s.games >= minGames)
    .sort((a, b) => {
      const diffA = a.scoreFor - a.scoreAgainst;
      const diffB = b.scoreFor - b.scoreAgainst;
      if (diffB !== diffA) return diffB - diffA;
      return b.winRate - a.winRate;
    });
}

// Head-to-head record between two players
export interface HeadToHead {
  player: string;
  opponent: string;
  asPartner: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
  };
  asOpponent: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
  };
}

export function getHeadToHead(
  sessions: Record<string, Session>,
  player: string,
  opponent: string,
  options?: { limitPartner?: number; limitOpponent?: number }
): HeadToHead {
  const result: HeadToHead = {
    player,
    opponent,
    asPartner: { games: 0, wins: 0, draws: 0, losses: 0 },
    asOpponent: { games: 0, wins: 0, draws: 0, losses: 0 },
  };

  const limitPartner = options?.limitPartner;
  const limitOpponent = options?.limitOpponent;

  // Sort sessions by date (most recent first)
  const sortedDates = Object.keys(sessions).sort().reverse();

  for (const date of sortedDates) {
    const session = sessions[date];
    // Iterate matches in reverse order (most recent first within a day)
    for (let idx = session.schedule.length - 1; idx >= 0; idx--) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      const t1Has = match.team1.includes(player);
      const t2Has = match.team2.includes(player);
      const oppT1 = match.team1.includes(opponent);
      const oppT2 = match.team2.includes(opponent);

      // Same team
      if ((t1Has && oppT1) || (t2Has && oppT2)) {
        if (limitPartner && result.asPartner.games >= limitPartner) continue;

        result.asPartner.games++;
        const teamResult =
          (t1Has && matchResult === 'W') || (t2Has && matchResult === 'L')
            ? 'W'
            : (t1Has && matchResult === 'L') || (t2Has && matchResult === 'W')
            ? 'L'
            : 'D';

        if (teamResult === 'W') result.asPartner.wins++;
        else if (teamResult === 'L') result.asPartner.losses++;
        else result.asPartner.draws++;
      }

      // Opposing teams
      if ((t1Has && oppT2) || (t2Has && oppT1)) {
        if (limitOpponent && result.asOpponent.games >= limitOpponent) continue;

        result.asOpponent.games++;
        const teamResult =
          (t1Has && matchResult === 'W') || (t2Has && matchResult === 'L')
            ? 'W'
            : (t1Has && matchResult === 'L') || (t2Has && matchResult === 'W')
            ? 'L'
            : 'D';

        if (teamResult === 'W') result.asOpponent.wins++;
        else if (teamResult === 'L') result.asOpponent.losses++;
        else result.asOpponent.draws++;
      }
    }

    // Early exit if both limits reached
    if (limitPartner && limitOpponent &&
        result.asPartner.games >= limitPartner &&
        result.asOpponent.games >= limitOpponent) {
      break;
    }
  }

  return result;
}

// Partner stats for a player
export interface PartnerStats {
  partner: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export function getPartnerStats(
  sessions: Record<string, Session>,
  player: string
): PartnerStats[] {
  const partnerMap: Record<
    string,
    { games: number; wins: number; draws: number; losses: number }
  > = {};

  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제' || match.gameType === '단식') continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      let team: string[] | null = null;
      let isWin = false;
      let isDraw = false;

      if (match.team1.includes(player)) {
        team = match.team1;
        isWin = matchResult === 'W';
        isDraw = matchResult === 'D';
      } else if (match.team2.includes(player)) {
        team = match.team2;
        isWin = matchResult === 'L';
        isDraw = matchResult === 'D';
      }

      if (!team) continue;

      for (const partner of team) {
        if (partner === player) continue;

        if (!partnerMap[partner]) {
          partnerMap[partner] = { games: 0, wins: 0, draws: 0, losses: 0 };
        }

        partnerMap[partner].games++;
        if (isWin) partnerMap[partner].wins++;
        else if (isDraw) partnerMap[partner].draws++;
        else partnerMap[partner].losses++;
      }
    }
  }

  return Object.entries(partnerMap)
    .map(([partner, stats]) => ({
      partner,
      ...stats,
      winRate: stats.games > 0 ? stats.wins / stats.games : 0,
    }))
    .sort((a, b) => b.games - a.games);
}

// Get player's individual stats with detailed breakdown
export interface DetailedPlayerStats extends PlayerStats {
  avgScoreFor: number;
  avgScoreAgainst: number;
  scoreDiff: number;
  longestWinStreak: number;
  longestLossStreak: number;
  recentForm: ('W' | 'L' | 'D')[];
}

export function getDetailedPlayerStats(
  sessions: Record<string, Session>,
  player: string
): DetailedPlayerStats {
  const base: PlayerStats = {
    name: player,
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    winRate: 0,
  };

  const results: { date: string; result: 'W' | 'L' | 'D' }[] = [];

  // Sort sessions by date
  const sortedDates = Object.keys(sessions).sort();

  for (const date of sortedDates) {
    const session = sessions[date];

    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const t1Has = match.team1.includes(player);
      const t2Has = match.team2.includes(player);
      if (!t1Has && !t2Has) continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      base.games++;

      const s1 = res?.t1 ?? 0;
      const s2 = res?.t2 ?? 0;

      if (t1Has) {
        base.scoreFor += s1;
        base.scoreAgainst += s2;
      } else {
        base.scoreFor += s2;
        base.scoreAgainst += s1;
      }

      const playerResult: 'W' | 'L' | 'D' =
        (t1Has && matchResult === 'W') || (t2Has && matchResult === 'L')
          ? 'W'
          : (t1Has && matchResult === 'L') || (t2Has && matchResult === 'W')
          ? 'L'
          : 'D';

      results.push({ date, result: playerResult });

      if (playerResult === 'W') {
        base.wins++;
        base.points += WP;
      } else if (playerResult === 'L') {
        base.losses++;
        base.points += LP;
      } else {
        base.draws++;
        base.points += DP;
      }
    }
  }

  // Calculate streaks
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const { result } of results) {
    if (result === 'W') {
      currentWinStreak++;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else if (result === 'L') {
      currentLossStreak++;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }

  // Recent form (last 5)
  const recentForm = results.slice(-5).map((r) => r.result);

  base.winRate = base.games > 0 ? base.wins / base.games : 0;

  return {
    ...base,
    avgScoreFor: base.games > 0 ? base.scoreFor / base.games : 0,
    avgScoreAgainst: base.games > 0 ? base.scoreAgainst / base.games : 0,
    scoreDiff: base.scoreFor - base.scoreAgainst,
    longestWinStreak,
    longestLossStreak,
    recentForm,
  };
}

// Get opponent stats for a player
export function getOpponentStats(
  sessions: Record<string, Session>,
  player: string
): OpponentStats[] {
  const opponentMap: Record<
    string,
    { games: number; wins: number; draws: number; losses: number }
  > = {};

  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      let myTeam: string[] | null = null;
      let oppTeam: string[] | null = null;
      let isWin = false;
      let isDraw = false;

      if (match.team1.includes(player)) {
        myTeam = match.team1;
        oppTeam = match.team2;
        isWin = matchResult === 'W';
        isDraw = matchResult === 'D';
      } else if (match.team2.includes(player)) {
        myTeam = match.team2;
        oppTeam = match.team1;
        isWin = matchResult === 'L';
        isDraw = matchResult === 'D';
      }

      if (!myTeam || !oppTeam) continue;

      for (const opponent of oppTeam) {
        if (!opponent || opponent === '게스트') continue;

        if (!opponentMap[opponent]) {
          opponentMap[opponent] = { games: 0, wins: 0, draws: 0, losses: 0 };
        }

        opponentMap[opponent].games++;
        if (isWin) opponentMap[opponent].wins++;
        else if (isDraw) opponentMap[opponent].draws++;
        else opponentMap[opponent].losses++;
      }
    }
  }

  return Object.entries(opponentMap)
    .map(([opponent, stats]) => ({
      opponent,
      ...stats,
      winRate: stats.games > 0 ? stats.wins / stats.games : 0,
    }))
    .sort((a, b) => b.games - a.games);
}

// Get monthly bests
export function getMonthlyBests(
  sessions: Record<string, Session>,
  memberSet?: Set<string>,
  roster?: Record<string, { hand?: string; racket?: string; ageGroup?: string; gender?: string; mbti?: string }>
): MonthlyBests {
  const stats = aggregateStats(sessions, memberSet);
  const ranking = Object.values(stats);
  const attendance = getAttendance(sessions, memberSet);

  const emptyResult: MonthlyBests = {
    mvp: null,
    scoreDiffKing: null,
    peacemaker: null,
    friendshipKing: null,
    attendanceKing: null,
    winStreakKing: null,
    bakeryKing: null,
    categoryBests: { hand: null, racket: null, ageGroup: null, gender: null, mbti: null },
  };

  if (ranking.length === 0) {
    return emptyResult;
  }

  // === 선수별 BEST ===

  // MVP: 승점 (승3 + 무1), 참석일, 득실차
  let mvp: MonthlyBests['mvp'] = null;
  let maxPoints = 0;
  for (const stat of ranking) {
    // 게스트 제외
    if (isGuest(stat.name)) continue;
    if (stat.points > maxPoints) {
      maxPoints = stat.points;
      mvp = {
        name: stat.name,
        points: stat.points,
        attendance: attendance[stat.name] || 0,
        scoreDiff: stat.scoreFor - stat.scoreAgainst,
      };
    }
  }

  // 격차왕: 평균 득실차가 가장 큰 사람 (최소 3경기)
  let scoreDiffKing: MonthlyBests['scoreDiffKing'] = null;
  let maxAvgDiff = -Infinity;
  for (const stat of ranking) {
    // 게스트 제외
    if (isGuest(stat.name)) continue;
    if (stat.games >= 3) {
      const avgFor = stat.scoreFor / stat.games;
      const avgAgainst = stat.scoreAgainst / stat.games;
      const avgDiff = avgFor - avgAgainst;
      if (avgDiff > maxAvgDiff) {
        maxAvgDiff = avgDiff;
        scoreDiffKing = {
          name: stat.name,
          avgFor: Math.round(avgFor * 100) / 100,
          avgAgainst: Math.round(avgAgainst * 100) / 100,
          avgDiff: Math.round(avgDiff * 100) / 100,
        };
      }
    }
  }

  // 평화주의자: 무승부 가장 많은 사람
  let peacemaker: MonthlyBests['peacemaker'] = null;
  let maxDraws = 0;
  for (const stat of ranking) {
    // 게스트 제외
    if (isGuest(stat.name)) continue;
    if (stat.draws > maxDraws) {
      maxDraws = stat.draws;
      peacemaker = { name: stat.name, draws: stat.draws };
    }
  }
  if (maxDraws === 0) peacemaker = null;

  // 우정왕 (파트너왕): 파트너 수 가장 많은 사람들
  const partnerCounts: Record<string, Set<string>> = {};
  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제' || match.gameType === '단식') continue;
      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      for (const team of [match.team1, match.team2]) {
        for (const player of team) {
          // 게스트 제외
          if (!player || isGuest(player)) continue;
          if (memberSet && !memberSet.has(player)) continue;
          if (!partnerCounts[player]) partnerCounts[player] = new Set();
          for (const partner of team) {
            if (partner !== player && partner && !isGuest(partner)) {
              partnerCounts[player].add(partner);
            }
          }
        }
      }
    }
  }

  let friendshipKing: MonthlyBests['friendshipKing'] = null;
  let maxPartners = 0;
  for (const [name, partners] of Object.entries(partnerCounts)) {
    // 게스트 제외
    if (isGuest(name)) continue;
    if (partners.size > maxPartners) {
      maxPartners = partners.size;
    }
  }
  if (maxPartners > 0) {
    const names = Object.entries(partnerCounts)
      .filter(([name, partners]) => !isGuest(name) && partners.size === maxPartners)
      .map(([name]) => name);
    friendshipKing = { names, count: maxPartners };
  }

  // 출석왕: 참석일 가장 많은 사람들
  let attendanceKing: MonthlyBests['attendanceKing'] = null;
  let maxDays = 0;
  for (const [name, days] of Object.entries(attendance)) {
    // 게스트 제외
    if (isGuest(name)) continue;
    if (days > maxDays) maxDays = days;
  }
  if (maxDays > 0) {
    const names = Object.entries(attendance)
      .filter(([name, days]) => !isGuest(name) && days === maxDays)
      .map(([name]) => name);
    attendanceKing = { names, days: maxDays };
  }

  // 연승왕: 최대 연승
  const winStreaks: Record<string, number> = {};
  const currentStreaks: Record<string, number> = {};
  const sortedDates = Object.keys(sessions).sort();

  for (const date of sortedDates) {
    const session = sessions[date];
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;
      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      const allPlayers = [...match.team1, ...match.team2].filter(
        (p) => p && !isGuest(p) && (!memberSet || memberSet.has(p))
      );

      for (const player of allPlayers) {
        const isTeam1 = match.team1.includes(player);
        const won = (isTeam1 && matchResult === 'W') || (!isTeam1 && matchResult === 'L');

        if (!currentStreaks[player]) currentStreaks[player] = 0;
        if (!winStreaks[player]) winStreaks[player] = 0;

        if (won) {
          currentStreaks[player]++;
          if (currentStreaks[player] > winStreaks[player]) {
            winStreaks[player] = currentStreaks[player];
          }
        } else {
          currentStreaks[player] = 0;
        }
      }
    }
  }

  let winStreakKing: MonthlyBests['winStreakKing'] = null;
  let maxStreak = 0;
  for (const [name, streak] of Object.entries(winStreaks)) {
    // 게스트 제외
    if (isGuest(name)) continue;
    if (streak > maxStreak) {
      maxStreak = streak;
      winStreakKing = { name, streak };
    }
  }
  if (maxStreak < 2) winStreakKing = null;

  // 제빵왕: 상대를 0점으로 이긴 경기 수
  const bakeryWins: Record<string, number> = {};
  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;
      const res = session.results[String(idx + 1)];
      if (res?.t1 == null || res?.t2 == null) continue;

      // Team1 won with 0 against
      if (res.t1 > res.t2 && res.t2 === 0) {
        for (const player of match.team1) {
          if (player && !isGuest(player) && (!memberSet || memberSet.has(player))) {
            bakeryWins[player] = (bakeryWins[player] || 0) + 1;
          }
        }
      }
      // Team2 won with 0 against
      if (res.t2 > res.t1 && res.t1 === 0) {
        for (const player of match.team2) {
          if (player && !isGuest(player) && (!memberSet || memberSet.has(player))) {
            bakeryWins[player] = (bakeryWins[player] || 0) + 1;
          }
        }
      }
    }
  }

  let bakeryKing: MonthlyBests['bakeryKing'] = null;
  let maxBakery = 0;
  for (const [name, count] of Object.entries(bakeryWins)) {
    // 게스트 제외
    if (isGuest(name)) continue;
    if (count > maxBakery) {
      maxBakery = count;
      bakeryKing = { name, count };
    }
  }

  // === 카테고리별 BEST ===
  const categoryBests: MonthlyBests['categoryBests'] = {
    hand: null,
    racket: null,
    ageGroup: null,
    gender: null,
    mbti: null,
  };

  if (roster) {
    const categoryTypes: Array<{ key: keyof typeof categoryBests; attr: string }> = [
      { key: 'hand', attr: 'hand' },
      { key: 'racket', attr: 'racket' },
      { key: 'ageGroup', attr: 'ageGroup' },
      { key: 'gender', attr: 'gender' },
      { key: 'mbti', attr: 'mbti' },
    ];

    for (const { key, attr } of categoryTypes) {
      const categoryStats: Record<string, { games: number; wins: number }> = {};

      for (const stat of ranking) {
        const playerInfo = roster[stat.name];
        const value = playerInfo?.[attr as keyof typeof playerInfo];
        if (!value || value === '모름' || value === '미배정' || value === '') continue;

        if (!categoryStats[value]) {
          categoryStats[value] = { games: 0, wins: 0 };
        }
        categoryStats[value].games += stat.games;
        categoryStats[value].wins += stat.wins;
      }

      let best: { value: string; winRate: number; games: number } | null = null;
      let maxGames = 0;
      for (const [value, data] of Object.entries(categoryStats)) {
        if (data.games > maxGames) {
          maxGames = data.games;
          best = {
            value,
            winRate: data.games > 0 ? Math.round((data.wins / data.games) * 1000) / 10 : 0,
            games: data.games,
          };
        }
      }
      categoryBests[key] = best;
    }
  }

  return {
    mvp,
    scoreDiffKing,
    peacemaker,
    friendshipKing,
    attendanceKing,
    winStreakKing,
    bakeryKing,
    categoryBests,
  };
}

// Get attendance (number of days played) for each player
export function getAttendance(
  sessions: Record<string, Session>,
  memberSet?: Set<string>
): AttendanceInfo {
  const attendance: Record<string, Set<string>> = {};

  for (const [date, session] of Object.entries(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      for (const player of [...match.team1, ...match.team2]) {
        if (!player || player === '게스트') continue;
        if (memberSet && !memberSet.has(player)) continue;

        if (!attendance[player]) {
          attendance[player] = new Set();
        }
        attendance[player].add(date);
      }
    }
  }

  const result: AttendanceInfo = {};
  for (const [name, dates] of Object.entries(attendance)) {
    result[name] = dates.size;
  }
  return result;
}

// Get side (position) stats for a player
export function getSideStats(
  sessions: Record<string, Session>,
  player: string
): SideStats {
  const result: SideStats = {
    deuce: { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 },
    ad: { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 },
  };

  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const res = session.results[String(idx + 1)];
      if (!res?.sides) continue;

      const matchResult = calcResult(res.t1, res.t2);
      if (matchResult === null) continue;

      const side = res.sides[player];
      if (!side || side === '모름') continue;

      const t1Has = match.team1.includes(player);
      const t2Has = match.team2.includes(player);
      if (!t1Has && !t2Has) continue;

      const isWin = (t1Has && matchResult === 'W') || (t2Has && matchResult === 'L');
      const isDraw = matchResult === 'D';

      const sideKey = side === '포(듀스)' ? 'deuce' : 'ad';
      result[sideKey].games++;
      if (isWin) result[sideKey].wins++;
      else if (isDraw) result[sideKey].draws++;
      else result[sideKey].losses++;
    }
  }

  result.deuce.winRate = result.deuce.games > 0 ? result.deuce.wins / result.deuce.games : 0;
  result.ad.winRate = result.ad.games > 0 ? result.ad.wins / result.ad.games : 0;

  return result;
}

// Group-based stats interface
export interface GroupStats {
  group: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

// Player info for group stats
interface PlayerRosterInfo {
  name: string;
  gender?: '남' | '여';
  hand?: '오른손' | '왼손';
  ntrp?: number | null;
  mbti?: string | null;
  racket?: string;
  ageGroup?: string;
  group?: string;
}

// Get stats by opponent's attribute (gender, hand, NTRP, MBTI, etc.)
export function getStatsByOpponentAttribute(
  sessions: Record<string, Session>,
  player: string,
  roster: Record<string, PlayerRosterInfo>,
  attribute: 'gender' | 'hand' | 'ntrp' | 'mbti' | 'racket' | 'ageGroup'
): GroupStats[] {
  const statsMap: Record<string, { games: number; wins: number; draws: number; losses: number }> = {};

  for (const session of Object.values(sessions)) {
    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      let myTeam: string[] | null = null;
      let oppTeam: string[] | null = null;
      let isWin = false;
      let isDraw = false;

      if (match.team1.includes(player)) {
        myTeam = match.team1;
        oppTeam = match.team2;
        isWin = matchResult === 'W';
        isDraw = matchResult === 'D';
      } else if (match.team2.includes(player)) {
        myTeam = match.team2;
        oppTeam = match.team1;
        isWin = matchResult === 'L';
        isDraw = matchResult === 'D';
      }

      if (!myTeam || !oppTeam) continue;

      // Get attribute values from opponents
      for (const opp of oppTeam) {
        const oppInfo = roster[opp];
        if (!oppInfo) continue;

        let attrValue: string | null = null;
        switch (attribute) {
          case 'gender':
            attrValue = oppInfo.gender || null;
            break;
          case 'hand':
            attrValue = oppInfo.hand || null;
            break;
          case 'ntrp':
            attrValue = oppInfo.ntrp ? String(oppInfo.ntrp) : null;
            break;
          case 'mbti':
            attrValue = oppInfo.mbti || null;
            break;
          case 'racket':
            attrValue = oppInfo.racket || null;
            break;
          case 'ageGroup':
            attrValue = oppInfo.ageGroup || null;
            break;
        }

        if (!attrValue || attrValue === '모름' || attrValue === '미배정' || attrValue === '') continue;

        if (!statsMap[attrValue]) {
          statsMap[attrValue] = { games: 0, wins: 0, draws: 0, losses: 0 };
        }

        statsMap[attrValue].games++;
        if (isWin) statsMap[attrValue].wins++;
        else if (isDraw) statsMap[attrValue].draws++;
        else statsMap[attrValue].losses++;
      }
    }
  }

  return Object.entries(statsMap)
    .map(([group, stats]) => ({
      group,
      ...stats,
      winRate: stats.games > 0 ? stats.wins / stats.games : 0,
    }))
    .sort((a, b) => b.games - a.games);
}

// Find best partner (천생연분) - highest win rate with 3+ games
export function findBestPartner(
  sessions: Record<string, Session>,
  player: string,
  minGames: number = 3
): PartnerStats | null {
  const partners = getPartnerStats(sessions, player);
  const qualified = partners.filter((p) => p.games >= minGames);
  if (qualified.length === 0) return null;

  return qualified.reduce((best, curr) =>
    curr.winRate > best.winRate ? curr : best
  );
}

// Find rival (라이벌) - opponent with ~50% win rate, 3+ games
export function findRival(
  sessions: Record<string, Session>,
  player: string,
  minGames: number = 3
): OpponentStats | null {
  const opponents = getOpponentStats(sessions, player);
  const qualified = opponents.filter((o) => o.games >= minGames);
  if (qualified.length === 0) return null;

  // Find closest to 50%
  return qualified.reduce((best, curr) => {
    const currDiff = Math.abs(curr.winRate - 0.5);
    const bestDiff = Math.abs(best.winRate - 0.5);
    return currDiff < bestDiff ? curr : best;
  });
}

// Find nemesis (천적) - opponent with lowest win rate, 3+ games
export function findNemesis(
  sessions: Record<string, Session>,
  player: string,
  minGames: number = 3
): OpponentStats | null {
  const opponents = getOpponentStats(sessions, player);
  const qualified = opponents.filter((o) => o.games >= minGames);
  if (qualified.length === 0) return null;

  return qualified.reduce((best, curr) =>
    curr.winRate < best.winRate ? curr : best
  );
}

// Monthly trend stats interface
export interface MonthlyTrendData {
  month: string; // 'YYYY-MM'
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

// Get monthly trend stats for a player
export function getMonthlyTrend(
  sessions: Record<string, Session>,
  player: string,
  months: number = 6
): MonthlyTrendData[] {
  const monthlyStats: Record<string, { games: number; wins: number; draws: number; losses: number }> = {};

  for (const [date, session] of Object.entries(sessions)) {
    const month = date.substring(0, 7); // 'YYYY-MM'

    for (let idx = 0; idx < session.schedule.length; idx++) {
      const match = session.schedule[idx];
      if (match.gameType === '삭제') continue;

      const t1Has = match.team1.includes(player);
      const t2Has = match.team2.includes(player);
      if (!t1Has && !t2Has) continue;

      const res = session.results[String(idx + 1)];
      const matchResult = calcResult(res?.t1, res?.t2);
      if (matchResult === null) continue;

      if (!monthlyStats[month]) {
        monthlyStats[month] = { games: 0, wins: 0, draws: 0, losses: 0 };
      }

      monthlyStats[month].games++;

      const playerResult =
        (t1Has && matchResult === 'W') || (t2Has && matchResult === 'L')
          ? 'W'
          : (t1Has && matchResult === 'L') || (t2Has && matchResult === 'W')
          ? 'L'
          : 'D';

      if (playerResult === 'W') monthlyStats[month].wins++;
      else if (playerResult === 'D') monthlyStats[month].draws++;
      else monthlyStats[month].losses++;
    }
  }

  // Sort by month and take last N months
  return Object.entries(monthlyStats)
    .map(([month, stats]) => ({
      month,
      ...stats,
      winRate: stats.games > 0 ? stats.wins / stats.games : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
}

// Match win probability interface
export interface MatchProbability {
  team1WinRate: number | null; // null means insufficient data
  team2WinRate: number | null;
  hasEnoughData: boolean;
  details?: {
    partnerFactor: { team1: number | null; team2: number | null };
    opponentFactor: { team1: number | null; team2: number | null };
    overallFactor: { team1: number | null; team2: number | null };
    ntrpFactor: { team1: number | null; team2: number | null };
  };
}

// Player info interface for NTRP
interface PlayerInfo {
  name: string;
  ntrp?: number | null;
}

// Calculate match win probability based on historical data and NTRP
export function calculateMatchProbability(
  sessions: Record<string, Session>,
  team1: string[],
  team2: string[],
  roster?: Record<string, PlayerInfo>,
  minGames: number = 1
): MatchProbability {
  // Weight factors for different components
  const WEIGHTS = {
    partner: 2.0,      // 파트너 궁합 (가중치 높음)
    opponent: 2.5,     // 상대 전적 (가장 중요)
    overall: 1.0,      // 개인 통산 승률
    ntrp: 1.5,         // NTRP 기반 예측
  };

  const factors: {
    partner: { team1: number | null; team2: number | null };
    opponent: { team1: number[]; team2: number[] };
    overall: { team1: number[]; team2: number[] };
    ntrp: { team1: number | null; team2: number | null };
  } = {
    partner: { team1: null, team2: null },
    opponent: { team1: [], team2: [] },
    overall: { team1: [], team2: [] },
    ntrp: { team1: null, team2: null },
  };

  // 1. Partner synergy stats (doubles only)
  if (team1.length === 2) {
    const partnerStats1 = getPartnerStats(sessions, team1[0]);
    const partner1 = partnerStats1.find(p => p.partner === team1[1]);
    if (partner1 && partner1.games >= minGames) {
      factors.partner.team1 = partner1.winRate;
    }
  }

  if (team2.length === 2) {
    const partnerStats2 = getPartnerStats(sessions, team2[0]);
    const partner2 = partnerStats2.find(p => p.partner === team2[1]);
    if (partner2 && partner2.games >= minGames) {
      factors.partner.team2 = partner2.winRate;
    }
  }

  // 2. Head-to-head opponent stats
  for (const p1 of team1) {
    const oppStats = getOpponentStats(sessions, p1);
    for (const p2 of team2) {
      const opp = oppStats.find(o => o.opponent === p2);
      if (opp && opp.games >= minGames) {
        factors.opponent.team1.push(opp.winRate);
        factors.opponent.team2.push(1 - opp.winRate);
      }
    }
  }

  // 3. Individual overall win rates
  const allStats = aggregateStats(sessions);
  for (const p of team1) {
    if (allStats[p] && allStats[p].games >= minGames) {
      factors.overall.team1.push(allStats[p].winRate);
    }
  }
  for (const p of team2) {
    if (allStats[p] && allStats[p].games >= minGames) {
      factors.overall.team2.push(allStats[p].winRate);
    }
  }

  // 4. NTRP-based probability
  if (roster) {
    const team1Ntrp: number[] = [];
    const team2Ntrp: number[] = [];

    for (const p of team1) {
      const playerInfo = roster[p];
      if (playerInfo?.ntrp && playerInfo.ntrp > 0) {
        team1Ntrp.push(playerInfo.ntrp);
      }
    }
    for (const p of team2) {
      const playerInfo = roster[p];
      if (playerInfo?.ntrp && playerInfo.ntrp > 0) {
        team2Ntrp.push(playerInfo.ntrp);
      }
    }

    if (team1Ntrp.length > 0 && team2Ntrp.length > 0) {
      const avgNtrp1 = team1Ntrp.reduce((a, b) => a + b, 0) / team1Ntrp.length;
      const avgNtrp2 = team2Ntrp.reduce((a, b) => a + b, 0) / team2Ntrp.length;

      // Convert NTRP difference to win probability
      // Each 0.5 NTRP difference ≈ 15% win rate difference
      const ntrpDiff = avgNtrp1 - avgNtrp2;
      const ntrpFactor = 0.5 + (ntrpDiff * 0.3); // 0.3 = 15% per 0.5 NTRP
      factors.ntrp.team1 = Math.max(0.1, Math.min(0.9, ntrpFactor));
      factors.ntrp.team2 = 1 - factors.ntrp.team1;
    }
  }

  // Calculate weighted average
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const components: { team1: number; team2: number; weight: number }[] = [];

  // Partner factor
  if (factors.partner.team1 !== null || factors.partner.team2 !== null) {
    const p1 = factors.partner.team1 ?? 0.5;
    const p2 = factors.partner.team2 ?? 0.5;
    components.push({ team1: p1, team2: p2, weight: WEIGHTS.partner });
  }

  // Opponent factor
  const oppAvg1 = avg(factors.opponent.team1);
  const oppAvg2 = avg(factors.opponent.team2);
  if (oppAvg1 !== null || oppAvg2 !== null) {
    components.push({
      team1: oppAvg1 ?? 0.5,
      team2: oppAvg2 ?? 0.5,
      weight: WEIGHTS.opponent
    });
  }

  // Overall factor
  const overallAvg1 = avg(factors.overall.team1);
  const overallAvg2 = avg(factors.overall.team2);
  if (overallAvg1 !== null || overallAvg2 !== null) {
    components.push({
      team1: overallAvg1 ?? 0.5,
      team2: overallAvg2 ?? 0.5,
      weight: WEIGHTS.overall
    });
  }

  // NTRP factor
  if (factors.ntrp.team1 !== null && factors.ntrp.team2 !== null) {
    components.push({
      team1: factors.ntrp.team1,
      team2: factors.ntrp.team2,
      weight: WEIGHTS.ntrp
    });
  }

  // No data available
  if (components.length === 0) {
    return {
      team1WinRate: null,
      team2WinRate: null,
      hasEnoughData: false,
    };
  }

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum1 = 0;
  let weightedSum2 = 0;

  for (const comp of components) {
    weightedSum1 += comp.team1 * comp.weight;
    weightedSum2 += comp.team2 * comp.weight;
    totalWeight += comp.weight;
  }

  let team1Prob = weightedSum1 / totalWeight;
  let team2Prob = weightedSum2 / totalWeight;

  // Normalize to ensure they add up to 1
  const total = team1Prob + team2Prob;
  if (total > 0) {
    team1Prob = team1Prob / total;
    team2Prob = team2Prob / total;
  } else {
    team1Prob = 0.5;
    team2Prob = 0.5;
  }

  return {
    team1WinRate: team1Prob,
    team2WinRate: team2Prob,
    hasEnoughData: true,
    details: {
      partnerFactor: factors.partner,
      opponentFactor: {
        team1: avg(factors.opponent.team1),
        team2: avg(factors.opponent.team2),
      },
      overallFactor: {
        team1: avg(factors.overall.team1),
        team2: avg(factors.overall.team2),
      },
      ntrpFactor: factors.ntrp,
    },
  };
}
