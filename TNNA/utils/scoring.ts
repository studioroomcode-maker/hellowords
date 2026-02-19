import { MatchResult, Session, Match, PlayerStats } from '../types';
import { WIN_POINT, DRAW_POINT, LOSE_POINT } from './constants';

// Calculate match result: 'W' = team1 wins, 'L' = team1 loses, 'D' = draw, null = incomplete
export function calcResult(
  t1Score: number | null | undefined,
  t2Score: number | null | undefined
): 'W' | 'L' | 'D' | null {
  if (t1Score === null || t1Score === undefined || t2Score === null || t2Score === undefined) {
    return null;
  }
  if (t1Score > t2Score) return 'W';
  if (t1Score < t2Score) return 'L';
  return 'D';
}

// Calculate points for a result
export function getPointsForResult(result: 'W' | 'L' | 'D' | null): number {
  switch (result) {
    case 'W':
      return WIN_POINT;
    case 'D':
      return DRAW_POINT;
    case 'L':
      return LOSE_POINT;
    default:
      return 0;
  }
}

// Count games per player from schedule
export function countPlayerGames(schedule: Match[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const match of schedule) {
    if (match.gameType === '삭제') continue;

    for (const player of [...match.team1, ...match.team2]) {
      counts[player] = (counts[player] || 0) + 1;
    }
  }

  return counts;
}

// Calculate daily stats for a session
export function calculateDailyStats(
  session: Session,
  memberSet?: Set<string>
): Record<string, PlayerStats> {
  const stats: Record<string, PlayerStats> = {};

  const isValidMember = (name: string): boolean => {
    if (!name || name === '게스트' || name.startsWith('게스트_') || name.startsWith('G')) return false;
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

  for (let idx = 0; idx < session.schedule.length; idx++) {
    const match = session.schedule[idx];
    if (match.gameType === '삭제') continue;

    const result = session.results[String(idx + 1)];
    const matchResult = calcResult(result?.t1, result?.t2);

    if (matchResult === null) continue;

    const validPlayers = [...match.team1, ...match.team2].filter(isValidMember);

    // Count games
    for (const player of validPlayers) {
      ensureStats(player);
      stats[player].games++;
    }

    // Score tracking
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

    // Win/Draw/Loss
    if (matchResult === 'W') {
      for (const player of match.team1.filter(isValidMember)) {
        stats[player].wins++;
        stats[player].points += WIN_POINT;
      }
      for (const player of match.team2.filter(isValidMember)) {
        stats[player].losses++;
        stats[player].points += LOSE_POINT;
      }
    } else if (matchResult === 'L') {
      for (const player of match.team2.filter(isValidMember)) {
        stats[player].wins++;
        stats[player].points += WIN_POINT;
      }
      for (const player of match.team1.filter(isValidMember)) {
        stats[player].losses++;
        stats[player].points += LOSE_POINT;
      }
    } else {
      for (const player of validPlayers) {
        stats[player].draws++;
        stats[player].points += DRAW_POINT;
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

// Helper to check if player is a guest
function isGuest(name: string): boolean {
  return name.startsWith('G') || name.startsWith('게스트_') || name.includes('게스트');
}

// Find today's MVP
export function findMVP(stats: Record<string, PlayerStats>): {
  name: string;
  stats: PlayerStats;
} | null {
  let best: { name: string; stats: PlayerStats } | null = null;
  let bestWins = -1;
  let bestDiff = -Infinity;

  for (const [name, s] of Object.entries(stats)) {
    if (s.games === 0) continue;
    // 게스트 제외
    if (isGuest(name)) continue;

    const diff = s.scoreFor - s.scoreAgainst;

    if (s.wins > bestWins || (s.wins === bestWins && diff > bestDiff)) {
      bestWins = s.wins;
      bestDiff = diff;
      best = { name, stats: s };
    }
  }

  return best;
}

// Find undefeated players
export function findUndefeated(stats: Record<string, PlayerStats>): string[] {
  return Object.entries(stats)
    .filter(([name, s]) => s.games > 0 && s.losses === 0 && !isGuest(name))
    .map(([name]) => name);
}

// Find shutout leaders (won with opponent at 0)
export function countShutouts(session: Session): Record<string, number> {
  const counts: Record<string, number> = {};

  for (let idx = 0; idx < session.schedule.length; idx++) {
    const match = session.schedule[idx];
    if (match.gameType === '삭제') continue;

    const result = session.results[String(idx + 1)];
    if (!result || result.t1 === null || result.t2 === null) continue;

    if (result.t1 > 0 && result.t2 === 0) {
      for (const player of match.team1) {
        // 게스트 제외
        if (isGuest(player)) continue;
        counts[player] = (counts[player] || 0) + 1;
      }
    } else if (result.t2 > 0 && result.t1 === 0) {
      for (const player of match.team2) {
        // 게스트 제외
        if (isGuest(player)) continue;
        counts[player] = (counts[player] || 0) + 1;
      }
    }
  }

  return counts;
}

// Detect score input warnings
export function detectScoreWarnings(session: Session): string[] {
  const warnings: string[] = [];

  for (let idx = 0; idx < session.schedule.length; idx++) {
    const match = session.schedule[idx];
    if (match.gameType === '삭제') continue;

    const matchNo = idx + 1;
    const result = session.results[String(matchNo)];

    if (!result || result.t1 === null || result.t2 === null) {
      warnings.push(`${matchNo}번 경기: 점수가 비어 있어요.`);
      continue;
    }

    // Draw that's not 5:5
    if (result.t1 === result.t2 && result.t1 !== 5) {
      warnings.push(
        `${matchNo}번 경기: ${result.t1}:${result.t2} → 5:5가 아닌 무승부 점수예요. 다시 한 번 확인해 주세요.`
      );
    }
  }

  return warnings;
}

// Build daily report
export function buildDailyReport(
  date: string,
  session: Session,
  memberSet?: Set<string>
): string[] {
  const stats = calculateDailyStats(session, memberSet);
  const lines: string[] = [];

  const attendees = Object.keys(stats).filter((name) => stats[name].games > 0);
  const totalGames = session.schedule.filter(
    (m, i) =>
      m.gameType !== '삭제' &&
      session.results[String(i + 1)]?.t1 !== null
  ).length;

  if (attendees.length === 0 || totalGames === 0) return [];

  // Basic info
  lines.push(`출석 인원 ${attendees.length}명, 점수 입력된 경기 ${totalGames}게임`);

  // MVP
  const mvp = findMVP(stats);
  if (mvp) {
    const diff = mvp.stats.scoreFor - mvp.stats.scoreAgainst;
    lines.push(
      `오늘의 MVP: ${mvp.name} (${mvp.stats.wins}승 ${mvp.stats.draws}무 ${mvp.stats.losses}패, 득실차 ${diff}점)`
    );
  }

  // Undefeated
  const undefeated = findUndefeated(stats);
  if (undefeated.length > 0) {
    lines.push(`오늘 무패 선수: ${undefeated.join(', ')}`);
  }

  // Shutout leaders
  const shutouts = countShutouts(session);
  if (Object.keys(shutouts).length > 0) {
    const maxShutouts = Math.max(...Object.values(shutouts));
    const leaders = Object.entries(shutouts)
      .filter(([_, count]) => count === maxShutouts)
      .map(([name]) => name);
    lines.push(
      `상대를 0점으로 이긴 셧아웃 경기 최다: ${leaders.join(', ')} (총 ${maxShutouts}번)`
    );
  }

  return lines;
}

// Get completion percentage
export function getCompletionPercentage(session: Session): number {
  const validMatches = session.schedule.filter((m) => m.gameType !== '삭제');
  if (validMatches.length === 0) return 0;

  let completed = 0;
  for (let i = 0; i < session.schedule.length; i++) {
    if (session.schedule[i].gameType === '삭제') continue;
    const result = session.results[String(i + 1)];
    if (result && result.t1 !== null && result.t2 !== null) {
      completed++;
    }
  }

  return Math.round((completed / validMatches.length) * 100);
}
