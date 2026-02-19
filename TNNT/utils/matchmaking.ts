import { Match, Player, DoublesMode, SinglesMode, ScheduleOptions, ManualSlot } from '../types';
import {
  HANUL_AA_PATTERNS,
  HANUL_AA_SEED_SLOTS,
  SCHEDULE_WEIGHTS,
  MIXED_DOUBLES_WEIGHTS,
} from './constants';

// Helper: Convert pattern character to index
function charToIndex(ch: string): number {
  if (ch >= '1' && ch <= '9') {
    return parseInt(ch) - 1;
  }
  // A=9 (10th), B=10 (11th), etc.
  return 9 + (ch.charCodeAt(0) - 'A'.charCodeAt(0));
}

// Helper: Parse pattern string (e.g., "12:34")
function parsePattern(pattern: string, players: string[]): [string[], string[]] {
  const [t1Raw, t2Raw] = pattern.split(':');
  const t1: string[] = [];
  const t2: string[] = [];

  for (const c of t1Raw) {
    const idx = charToIndex(c);
    if (idx >= 0 && idx < players.length) {
      t1.push(players[idx]);
    }
  }

  for (const c of t2Raw) {
    const idx = charToIndex(c);
    if (idx >= 0 && idx < players.length) {
      t2.push(players[idx]);
    }
  }

  return [t1, t2];
}

// Helper: Create pair key
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// Helper: Get effective NTRP value (관리NTRP 우선 사용 시 adminNtrp 반환)
let _useAdminNtrp = false;
function setUseAdminNtrp(val: boolean) { _useAdminNtrp = val; }
function getEffectiveNtrp(player: Player | undefined): number | null {
  if (!player) return null;
  if (_useAdminNtrp && player.adminNtrp != null) return player.adminNtrp;
  return player.ntrp;
}
function getNtrpValue(player: Player | undefined): number {
  return getEffectiveNtrp(player) ?? 2.0;
}

// Helper: Shuffle array
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Helper: Get combinations
function* combinations<T>(array: T[], r: number): Generator<T[]> {
  const n = array.length;
  if (r > n) return;

  const indices = Array.from({ length: r }, (_, i) => i);
  yield indices.map((i) => array[i]);

  while (true) {
    let i = r - 1;
    while (i >= 0 && indices[i] === i + n - r) {
      i--;
    }
    if (i < 0) return;

    indices[i]++;
    for (let j = i + 1; j < r; j++) {
      indices[j] = indices[j - 1] + 1;
    }
    yield indices.map((i) => array[i]);
  }
}

/**
 * Build Hanul AA schedule (5-16 players)
 * Pre-defined patterns guarantee exactly 4 games per player
 */
export function buildHanulAASchedule(
  players: string[],
  courtCount: number
): Match[] {
  const n = players.length;
  if (!(n in HANUL_AA_PATTERNS)) {
    return [];
  }

  const patterns = HANUL_AA_PATTERNS[n];
  const schedule: Match[] = [];

  for (let i = 0; i < patterns.length; i++) {
    const [t1, t2] = parsePattern(patterns[i], players);
    if (t1.length !== 2 || t2.length !== 2) continue;

    const court = (i % courtCount) + 1;
    schedule.push({
      gameType: '복식',
      team1: t1,
      team2: t2,
      court,
    });
  }

  return schedule;
}

/**
 * Apply Hanul AA seed ordering
 */
export function applyHanulAASeedOrder(
  players: string[],
  seedPlayers: string[]
): [string[], string[]] {
  const n = players.length;
  const slots = HANUL_AA_SEED_SLOTS[n] || [];

  if (!slots.length || !seedPlayers.length) {
    return [players, slots];
  }

  // Clean seed list
  const seedUnique: string[] = [];
  for (const p of seedPlayers) {
    if (players.includes(p) && !seedUnique.includes(p)) {
      seedUnique.push(p);
    }
  }

  const slotIndices = slots.map((s) => {
    if (s >= '1' && s <= '9') return parseInt(s) - 1;
    return 9 + (s.charCodeAt(0) - 'A'.charCodeAt(0));
  });

  const limitedSeeds = seedUnique.slice(0, slotIndices.length);
  const ordered: (string | null)[] = new Array(n).fill(null);

  // Place seed players in their slots
  for (let i = 0; i < limitedSeeds.length; i++) {
    const si = slotIndices[i];
    if (si >= 0 && si < n) {
      ordered[si] = limitedSeeds[i];
    }
  }

  // Fill remaining with other players
  const remaining = players.filter((p) => !limitedSeeds.includes(p));
  for (let i = 0; i < n; i++) {
    if (ordered[i] === null && remaining.length > 0) {
      ordered[i] = remaining.shift()!;
    }
  }

  return [ordered.filter((x): x is string => x !== null), slots];
}

/**
 * Build mixed doubles schedule (strict: teams must be 1M + 1F)
 */
export function buildMixedDoublesSchedule(
  players: string[],
  rosterByName: Record<string, Player>,
  maxGames: number,
  courtCount: number,
  useNtrp: boolean
): Match[] {
  const getGender = (name: string) => rosterByName[name]?.gender ?? '남';
  const getNtrp = (name: string) => getEffectiveNtrp(rosterByName[name]);

  const men = players.filter((p) => getGender(p) === '남');
  const women = players.filter((p) => getGender(p) === '여');

  // Need at least 2 men and 2 women
  if (men.length < 2 || women.length < 2) {
    return [];
  }

  const counts: Record<string, number> = {};
  for (const p of players) counts[p] = 0;

  const partnersHist = new Set<string>();
  const opponentsHist = new Set<string>();

  const schedule: Match[] = [];
  let noProgress = 0;

  while (true) {
    if (players.every((p) => counts[p] >= maxGames)) break;

    const roundUsed = new Set<string>();
    let madeAny = false;

    for (let court = 1; court <= courtCount; court++) {
      const availM = men.filter(
        (p) => counts[p] < maxGames && !roundUsed.has(p)
      );
      const availW = women.filter(
        (p) => counts[p] < maxGames && !roundUsed.has(p)
      );

      if (availM.length < 2 || availW.length < 2) continue;

      let best: { score: number; t1: string[]; t2: string[] } | null = null;

      // Try random combinations
      for (let tries = 0; tries < 180; tries++) {
        const ms = shuffle(availM).slice(0, 2);
        const ws = shuffle(availW).slice(0, 2);

        const pairings: [string[], string[]][] = [
          [[ms[0], ws[0]], [ms[1], ws[1]]],
          [[ms[0], ws[1]], [ms[1], ws[0]]],
        ];

        for (const [t1, t2] of pairings) {
          // Verify mixed teams
          if (
            getGender(t1[0]) === getGender(t1[1]) ||
            getGender(t2[0]) === getGender(t2[1])
          ) {
            continue;
          }

          let score = 0;

          // Partner repeat penalty
          if (partnersHist.has(pairKey(t1[0], t1[1]))) {
            score += MIXED_DOUBLES_WEIGHTS.PARTNER_REPEAT;
          }
          if (partnersHist.has(pairKey(t2[0], t2[1]))) {
            score += MIXED_DOUBLES_WEIGHTS.PARTNER_REPEAT;
          }

          // Opponent repeat penalty
          for (const a of t1) {
            for (const b of t2) {
              if (opponentsHist.has(pairKey(a, b))) {
                score += MIXED_DOUBLES_WEIGHTS.OPPONENT_REPEAT;
              }
            }
          }

          // Prefer players with fewer games
          score +=
            MIXED_DOUBLES_WEIGHTS.GAME_COUNT *
            (counts[t1[0]] + counts[t1[1]] + counts[t2[0]] + counts[t2[1]]);

          // NTRP balance
          if (useNtrp) {
            const n1 = t1.map((x) => getNtrp(x) ?? 3.0);
            const n2 = t2.map((x) => getNtrp(x) ?? 3.0);
            score +=
              MIXED_DOUBLES_WEIGHTS.NTRP_BALANCE *
              Math.abs((n1[0] + n1[1]) / 2 - (n2[0] + n2[1]) / 2);
          }

          // Small random factor
          score += Math.random() * 0.01;

          if (best === null || score < best.score) {
            best = { score, t1, t2 };
          }
        }
      }

      if (!best) continue;

      schedule.push({
        gameType: '복식',
        team1: best.t1,
        team2: best.t2,
        court,
      });

      for (const p of [...best.t1, ...best.t2]) {
        roundUsed.add(p);
        counts[p]++;
      }

      partnersHist.add(pairKey(best.t1[0], best.t1[1]));
      partnersHist.add(pairKey(best.t2[0], best.t2[1]));

      for (const a of best.t1) {
        for (const b of best.t2) {
          opponentsHist.add(pairKey(a, b));
        }
      }

      madeAny = true;
    }

    if (!madeAny) {
      noProgress++;
      if (noProgress >= 2) break;
    } else {
      noProgress = 0;
    }
  }

  return schedule;
}

/**
 * Build doubles schedule (random/same-gender)
 */
export function buildDoublesSchedule(
  players: string[],
  rosterByName: Record<string, Player>,
  maxGames: number,
  courtCount: number,
  mode: DoublesMode,
  useNtrp: boolean,
  groupOnly: boolean
): Match[] {
  // Mixed doubles uses strict algorithm
  if (mode === '혼합복식') {
    return buildMixedDoublesSchedule(
      players,
      rosterByName,
      maxGames,
      courtCount,
      useNtrp
    );
  }

  if (players.length < 4) return [];

  const meta: Record<string, Player> = {};
  for (const p of players) {
    meta[p] = rosterByName[p] || ({} as Player);
  }

  const genders: Record<string, string> = {};
  const groups: Record<string, string> = {};
  for (const p of players) {
    genders[p] = meta[p]?.gender ?? '남';
    groups[p] = meta[p]?.group ?? '미배정';
  }

  const teamAvgNtrp = (team: string[]): number => {
    const vals = team.map((p) => getEffectiveNtrp(meta[p])).filter((v) => v != null) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  // State tracking
  const gamesPlayed: Record<string, number> = {};
  const partnerCounts: Record<string, number> = {};
  const opponentCounts: Record<string, number> = {};
  const lastPartner: Record<string, string | null> = {};
  const lastOpps: Record<string, Set<string>> = {};
  const lastRoundPlayed: Record<string, number> = {};

  for (const p of players) {
    gamesPlayed[p] = 0;
    lastPartner[p] = null;
    lastOpps[p] = new Set();
    lastRoundPlayed[p] = -999;
  }

  const {
    W_PARTNER,
    W_OPP,
    W_RECENT_P,
    W_RECENT_O,
    W_FAIR,
    W_NTRP,
    W_GAP_1,
    W_GAP_2,
    W_PACE,
  } = SCHEDULE_WEIGHTS;

  // Estimate total rounds
  const totalSlotsNeeded = players.length * maxGames;
  const matchesNeeded = Math.ceil(totalSlotsNeeded / 4);
  const totalRoundsEst = Math.max(1, Math.ceil(matchesNeeded / Math.max(1, courtCount)));

  const canUseFour = (four: string[]): boolean => {
    if (groupOnly) {
      const uniqueGroups = new Set(four.map((p) => groups[p]));
      if (uniqueGroups.size > 1) return false;
    }
    if (mode === '동성복식') {
      const uniqueGenders = new Set(four.map((p) => genders[p]));
      if (uniqueGenders.size > 1) return false;
    }
    return true;
  };

  const gapPenalty = (p: string, roundNo: number): number => {
    const gap = roundNo - lastRoundPlayed[p];
    if (gap === 1) return W_GAP_1;
    if (gap === 2) return W_GAP_2;
    return 0;
  };

  const pacePenalty = (p: string, roundNo: number): number => {
    const expected = maxGames * (roundNo / totalRoundsEst);
    const actual = gamesPlayed[p] + 1;
    const diff = actual - expected;
    if (diff > 0.6) return (diff - 0.6) * W_PACE;
    return 0;
  };

  const scorePairing = (
    t1: string[],
    t2: string[],
    roundNo: number
  ): number => {
    const [a, b] = t1;
    const [c, d] = t2;
    let s = 0;

    // Partner repeat (squared penalty)
    const p1 = pairKey(a, b);
    const p2 = pairKey(c, d);
    s += Math.pow(partnerCounts[p1] || 0, 2) * W_PARTNER;
    s += Math.pow(partnerCounts[p2] || 0, 2) * W_PARTNER;

    // Recent partner strong penalty
    if (lastPartner[a] === b || lastPartner[b] === a) s += W_RECENT_P;
    if (lastPartner[c] === d || lastPartner[d] === c) s += W_RECENT_P;

    // Opponent repeat
    const cross = [
      [a, c],
      [a, d],
      [b, c],
      [b, d],
    ];
    for (const [x, y] of cross) {
      s += Math.pow(opponentCounts[pairKey(x, y)] || 0, 2) * W_OPP;
      if (lastOpps[x]?.has(y)) s += W_RECENT_O;
    }

    // Gap penalties
    for (const p of [a, b, c, d]) {
      s += gapPenalty(p, roundNo);
      s += pacePenalty(p, roundNo);
    }

    // Game count variance
    const proj = { ...gamesPlayed };
    for (const p of [a, b, c, d]) proj[p]++;
    const vals = Object.values(proj);
    s += (Math.max(...vals) - Math.min(...vals)) * W_FAIR;

    // NTRP balance
    if (useNtrp) {
      s += Math.abs(teamAvgNtrp(t1) - teamAvgNtrp(t2)) * W_NTRP;
    }

    return s;
  };

  const schedule: Match[] = [];
  let roundNo = 0;

  while (true) {
    const eligible = players.filter((p) => gamesPlayed[p] < maxGames);
    if (eligible.length < 4) break;

    roundNo++;
    const usedInRound = new Set<string>();
    let madeAny = false;

    for (let court = 1; court <= courtCount; court++) {
      const avail = eligible.filter(
        (p) => !usedInRound.has(p) && gamesPlayed[p] < maxGames
      );
      if (avail.length < 4) break;

      // Sort by games played + random
      avail.sort((a, b) => {
        const diff = gamesPlayed[a] - gamesPlayed[b];
        return diff !== 0 ? diff : Math.random() - 0.5;
      });

      const poolN = Math.min(avail.length, 18);
      const pool = avail.slice(0, poolN);

      let best: { score: number; t1: string[]; t2: string[] } | null = null;

      for (const four of combinations(pool, 4)) {
        if (!canUseFour(four)) continue;

        const [a, b, c, d] = four;
        const pairings: [string[], string[]][] = [
          [[a, b], [c, d]],
          [[a, c], [b, d]],
          [[a, d], [b, c]],
        ];

        for (const [t1, t2] of pairings) {
          const sc = scorePairing(t1, t2, roundNo);
          if (best === null || sc < best.score) {
            best = { score: sc, t1, t2 };
          }
        }
      }

      // Expand search if needed
      if (best === null && avail.length <= 22) {
        for (const four of combinations(avail, 4)) {
          if (!canUseFour(four)) continue;

          const [a, b, c, d] = four;
          const pairings: [string[], string[]][] = [
            [[a, b], [c, d]],
            [[a, c], [b, d]],
            [[a, d], [b, c]],
          ];

          for (const [t1, t2] of pairings) {
            const sc = scorePairing(t1, t2, roundNo);
            if (best === null || sc < best.score) {
              best = { score: sc, t1, t2 };
            }
          }
        }
      }

      if (!best) continue;

      schedule.push({
        gameType: '복식',
        team1: best.t1,
        team2: best.t2,
        court,
      });

      madeAny = true;

      // Update state
      for (const p of [...best.t1, ...best.t2]) {
        gamesPlayed[p]++;
        usedInRound.add(p);
        lastRoundPlayed[p] = roundNo;
      }

      const pk1 = pairKey(best.t1[0], best.t1[1]);
      const pk2 = pairKey(best.t2[0], best.t2[1]);
      partnerCounts[pk1] = (partnerCounts[pk1] || 0) + 1;
      partnerCounts[pk2] = (partnerCounts[pk2] || 0) + 1;

      for (const x of best.t1) {
        for (const y of best.t2) {
          const ok = pairKey(x, y);
          opponentCounts[ok] = (opponentCounts[ok] || 0) + 1;
        }
      }

      lastPartner[best.t1[0]] = best.t1[1];
      lastPartner[best.t1[1]] = best.t1[0];
      lastPartner[best.t2[0]] = best.t2[1];
      lastPartner[best.t2[1]] = best.t2[0];

      lastOpps[best.t1[0]] = new Set(best.t2);
      lastOpps[best.t1[1]] = new Set(best.t2);
      lastOpps[best.t2[0]] = new Set(best.t1);
      lastOpps[best.t2[1]] = new Set(best.t1);
    }

    if (!madeAny) break;
  }

  return schedule;
}

/**
 * Build singles schedule
 */
export function buildSinglesSchedule(
  players: string[],
  rosterByName: Record<string, Player>,
  maxGames: number,
  courtCount: number,
  mode: SinglesMode,
  useNtrp: boolean,
  groupOnly: boolean
): Match[] {
  if (players.length < 2) return [];

  const meta: Record<string, Player> = {};
  for (const p of players) {
    meta[p] = rosterByName[p] || ({} as Player);
  }

  const genders: Record<string, string> = {};
  const groups: Record<string, string> = {};
  for (const p of players) {
    genders[p] = meta[p]?.gender ?? '남';
    groups[p] = meta[p]?.group ?? '미배정';
  }

  const gamesPlayed: Record<string, number> = {};
  const opponentCounts: Record<string, number> = {};
  const lastRoundPlayed: Record<string, number> = {};
  for (const p of players) {
    gamesPlayed[p] = 0;
    lastRoundPlayed[p] = -999;
  }

  const canPair = (a: string, b: string): boolean => {
    if (groupOnly && groups[a] !== groups[b]) return false;
    if (mode === '동성 단식' && genders[a] !== genders[b]) return false;
    if (mode === '혼합 단식' && genders[a] === genders[b]) return false;
    return true;
  };

  // 스코어링: 낮을수록 좋은 매칭
  const scorePair = (a: string, b: string, roundNo: number): number => {
    let s = 0;

    // 1) 공정성 (최우선): 게임수 차이 최소화
    const projA = gamesPlayed[a] + 1;
    const projB = gamesPlayed[b] + 1;
    const projCounts = { ...gamesPlayed, [a]: projA, [b]: projB };
    const vals = Object.values(projCounts);
    const maxG = Math.max(...vals);
    const minG = Math.min(...vals);
    s += (maxG - minG) * 50;

    // 게임수 적은 선수 우선
    s += (gamesPlayed[a] + gamesPlayed[b]) * 8;

    // 2) 상대 다양성: 같은 상대 반복 페널티
    const oppKey = pairKey(a, b);
    s += Math.pow(opponentCounts[oppKey] || 0, 2) * 30;

    // 3) 라운드 분포: 연속 출전 페널티
    for (const p of [a, b]) {
      const gap = roundNo - lastRoundPlayed[p];
      if (gap === 1) s += 60;
      else if (gap === 2) s += 20;
    }

    // 4) NTRP 밸런스
    if (useNtrp) {
      s += Math.abs(getNtrpValue(meta[a]) - getNtrpValue(meta[b])) * 5;
    }

    // 약간의 랜덤성
    s += Math.random() * 2;

    return s;
  };

  const schedule: Match[] = [];
  // 라운드 기반 생성
  const matchesPerRound = Math.min(courtCount, Math.floor(players.length / 2));
  const totalRoundsEst = Math.max(1, Math.ceil((players.length * maxGames) / (2 * matchesPerRound)));

  let roundNo = 0;
  let staleRounds = 0;

  while (staleRounds < 3) {
    // 아직 게임이 남은 선수가 2명 이상인지 확인
    const eligible = players.filter(p => gamesPlayed[p] < maxGames);
    if (eligible.length < 2) break;

    // 페어 가능한 조합이 있는지 확인
    let hasPairableCombo = false;
    for (let i = 0; i < eligible.length - 1 && !hasPairableCombo; i++) {
      for (let j = i + 1; j < eligible.length && !hasPairableCombo; j++) {
        if (canPair(eligible[i], eligible[j])) hasPairableCombo = true;
      }
    }
    if (!hasPairableCombo) break;

    roundNo++;
    const usedInRound = new Set<string>();
    let madeAny = false;

    for (let court = 1; court <= courtCount; court++) {
      const avail = eligible.filter(p => !usedInRound.has(p) && gamesPlayed[p] < maxGames);
      if (avail.length < 2) break;

      // 게임수 적은 순 + 랜덤 정렬 → 상위 풀에서 최적 페어 탐색
      avail.sort((a, b) => {
        const diff = gamesPlayed[a] - gamesPlayed[b];
        return diff !== 0 ? diff : Math.random() - 0.5;
      });

      const poolSize = Math.min(avail.length, 14);
      const pool = avail.slice(0, poolSize);

      let best: { score: number; a: string; b: string } | null = null;

      for (let i = 0; i < pool.length - 1; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          if (!canPair(pool[i], pool[j])) continue;
          const sc = scorePair(pool[i], pool[j], roundNo);
          if (best === null || sc < best.score) {
            best = { score: sc, a: pool[i], b: pool[j] };
          }
        }
      }

      if (!best) continue;

      const { a, b } = best;
      gamesPlayed[a]++;
      gamesPlayed[b]++;
      opponentCounts[pairKey(a, b)] = (opponentCounts[pairKey(a, b)] || 0) + 1;
      lastRoundPlayed[a] = roundNo;
      lastRoundPlayed[b] = roundNo;
      usedInRound.add(a);
      usedInRound.add(b);

      schedule.push({
        gameType: '단식',
        team1: [a],
        team2: [b],
        court,
      });
      madeAny = true;
    }

    if (!madeAny) {
      staleRounds++;
    } else {
      staleRounds = 0;
    }
  }

  return schedule;
}

/**
 * Main schedule builder
 */
export function buildSchedule(
  players: string[],
  rosterByName: Record<string, Player>,
  options: ScheduleOptions
): Match[] {
  const { mode, maxGames, courtCount, useNtrp, useAdminNtrp: adminNtrpOpt, groupOnly } = options;
  setUseAdminNtrp(!!adminNtrpOpt);

  // Hanul AA (5-16 players only)
  if (mode === '한울 AA') {
    if (players.length >= 5 && players.length <= 16) {
      return buildHanulAASchedule(players, courtCount);
    }
    // Fall back to random doubles if out of range
    return buildDoublesSchedule(
      players,
      rosterByName,
      maxGames,
      courtCount,
      '랜덤복식',
      useNtrp,
      groupOnly
    );
  }

  // Singles modes
  if (
    mode === '랜덤 단식' ||
    mode === '동성 단식' ||
    mode === '혼합 단식'
  ) {
    return buildSinglesSchedule(
      players,
      rosterByName,
      maxGames,
      courtCount,
      mode as SinglesMode,
      useNtrp,
      groupOnly
    );
  }

  // Doubles modes
  return buildDoublesSchedule(
    players,
    rosterByName,
    maxGames,
    courtCount,
    mode as DoublesMode,
    useNtrp,
    groupOnly
  );
}

// ========================================================
// 수동 대진 (Manual Schedule) 관련 함수들
// ========================================================

/**
 * 수동 슬롯 데이터를 Match[] 배열로 변환
 */
export function buildManualSchedule(
  slots: ManualSlot[][],
  gameType: '복식' | '단식',
  courtCount: number,
): Match[] {
  const matches: Match[] = [];
  for (let r = 0; r < slots.length; r++) {
    for (let c = 0; c < Math.min(slots[r].length, courtCount); c++) {
      const slot = slots[r][c];
      const team1 = slot.team1.filter((n): n is string => n !== null && n !== '선택');
      const team2 = slot.team2.filter((n): n is string => n !== null && n !== '선택');

      const needed = gameType === '단식' ? 1 : 2;
      if (team1.length === needed && team2.length === needed) {
        const allPlayers = [...team1, ...team2];
        if (new Set(allPlayers).size === allPlayers.length) {
          matches.push({
            gameType,
            team1,
            team2,
            court: c + 1,
          });
        }
      }
    }
  }
  return matches;
}

/**
 * 빈칸 자동 채우기 (공정성 기반)
 */
export function autoFillSlots(
  slots: ManualSlot[][],
  players: string[],
  rosterByName: Record<string, Player>,
  gameType: '복식' | '단식',
  courtCount: number,
  globalGenderMode: string,
  useNtrp: boolean,
  checkedOnly: boolean,
  useAdminNtrp?: boolean,
): ManualSlot[][] {
  setUseAdminNtrp(!!useAdminNtrp);
  const newSlots = slots.map(r => r.map(s => ({
    ...s,
    team1: [...s.team1],
    team2: [...s.team2],
  })));

  // --- 상태 추적 ---
  const counts: Record<string, number> = {};
  const partnerCounts: Record<string, number> = {};
  const opponentCounts: Record<string, number> = {};
  const lastRoundPlayed: Record<string, number> = {};
  players.forEach(p => { counts[p] = 0; lastRoundPlayed[p] = -999; });

  // 기존에 배정된 선수로부터 상태 초기화
  for (let r = 0; r < newSlots.length; r++) {
    for (const slot of newSlots[r]) {
      const t1Valid = slot.team1.filter((n): n is string => !!n && n !== '선택');
      const t2Valid = slot.team2.filter((n): n is string => !!n && n !== '선택');
      for (const n of [...t1Valid, ...t2Valid]) {
        counts[n] = (counts[n] || 0) + 1;
        lastRoundPlayed[n] = r;
      }
      // 파트너 카운트
      if (t1Valid.length === 2) partnerCounts[pairKey(t1Valid[0], t1Valid[1])] = (partnerCounts[pairKey(t1Valid[0], t1Valid[1])] || 0) + 1;
      if (t2Valid.length === 2) partnerCounts[pairKey(t2Valid[0], t2Valid[1])] = (partnerCounts[pairKey(t2Valid[0], t2Valid[1])] || 0) + 1;
      // 상대 카운트
      for (const a of t1Valid) {
        for (const b of t2Valid) {
          opponentCounts[pairKey(a, b)] = (opponentCounts[pairKey(a, b)] || 0) + 1;
        }
      }
    }
  }

  const playersPerTeam = gameType === '단식' ? 1 : 2;
  const totalRounds = newSlots.length;

  // --- 선수 선택 스코어링 (낮을수록 좋음) ---
  const scoreCandidate = (
    p: string,
    roundIdx: number,
    team: (string | null)[],
    otherTeam: (string | null)[],
    teamIdx: number,
  ): number => {
    let s = 0;

    // 1) 게임수 공정성: 최소 게임수 + 1 이하만 허용 (hard), 적을수록 좋음
    const minGames = Math.min(...players.map(pp => counts[pp] || 0));
    if ((counts[p] || 0) > minGames + 1) return 99999; // hard block
    s += (counts[p] || 0) * 20;

    // 2) 라운드 분포: 연속 출전 강하게 페널티, 적절한 간격 선호
    const gap = roundIdx - (lastRoundPlayed[p] ?? -999);
    if (gap === 1) s += 80;
    else if (gap === 2) s += 30;

    // 페이스 페널티: 총 라운드 대비 현재 게임 비율
    if (totalRounds > 1) {
      const expectedPace = ((counts[p] || 0) + 1) / (Math.max(1, ...Object.values(counts)) || 1);
      const roundPace = (roundIdx + 1) / totalRounds;
      const paceDiff = expectedPace - roundPace;
      if (paceDiff > 0.3) s += paceDiff * 25;
    }

    // 3) 파트너 다양성 (복식)
    const existingPartner = team.filter((n): n is string => !!n && n !== '선택');
    if (playersPerTeam === 2 && teamIdx >= 0 && existingPartner.length > 0) {
      for (const partner of existingPartner) {
        const pk = pairKey(p, partner);
        s += (partnerCounts[pk] || 0) * 35;
      }
    }

    // 4) 상대 다양성
    const existingOpps = otherTeam.filter((n): n is string => !!n && n !== '선택');
    for (const opp of existingOpps) {
      const ok = pairKey(p, opp);
      s += (opponentCounts[ok] || 0) * 15;
    }

    // 5) NTRP 밸런스
    if (useNtrp && existingPartner.length > 0) {
      const refNtrp = getNtrpValue(rosterByName[existingPartner[0]]);
      s += Math.abs(getNtrpValue(rosterByName[p]) - refNtrp) * 5;
    }

    // 약간의 랜덤성 (동점 방지)
    s += Math.random() * 3;

    return s;
  };

  // --- 슬롯 채우기 ---
  for (let r = 0; r < newSlots.length; r++) {
    // 이 라운드에서 이미 배정된 선수 수집
    const usedInRound = new Set<string>();
    for (let cc = 0; cc < Math.min(newSlots[r].length, courtCount); cc++) {
      const s = newSlots[r][cc];
      [...s.team1, ...s.team2].forEach(n => {
        if (n && n !== '선택') usedInRound.add(n);
      });
    }

    for (let c = 0; c < Math.min(newSlots[r].length, courtCount); c++) {
      const slot = newSlots[r][c];
      if (checkedOnly && !slot.checked) continue;

      const genderMode = slot.genderMode || globalGenderMode;

      const fillTeam = (team: (string | null)[], teamIdx: number, otherTeam: (string | null)[]) => {
        for (let i = 0; i < playersPerTeam; i++) {
          if (i < team.length && team[i] && team[i] !== '선택') continue;
          while (team.length <= i) team.push(null);

          let candidates = players.filter(p => !usedInRound.has(p));
          candidates = filterByGenderMode(candidates, rosterByName, genderMode, team, teamIdx, i, playersPerTeam, otherTeam);
          if (candidates.length === 0) continue;

          // 스코어 기반 선택 (최소 스코어 선수 선택)
          const scored = candidates.map(p => ({
            player: p,
            score: scoreCandidate(p, r, team, otherTeam, teamIdx),
          }));
          scored.sort((a, b) => a.score - b.score);

          // 유효 후보만 (99999 미만)
          const valid = scored.filter(s => s.score < 99999);
          if (valid.length === 0) continue;

          const pick = valid[0].player;
          team[i] = pick;
          usedInRound.add(pick);
          counts[pick] = (counts[pick] || 0) + 1;
          lastRoundPlayed[pick] = r;
        }
      };

      // 팀1 채우기 (팀2를 참고)
      fillTeam(slot.team1, 0, slot.team2);
      // 팀2 채우기 (팀1을 참고)
      fillTeam(slot.team2, 1, slot.team1);

      // 파트너/상대 카운트 업데이트
      const t1Done = slot.team1.filter((n): n is string => !!n && n !== '선택');
      const t2Done = slot.team2.filter((n): n is string => !!n && n !== '선택');
      if (t1Done.length === 2) partnerCounts[pairKey(t1Done[0], t1Done[1])] = (partnerCounts[pairKey(t1Done[0], t1Done[1])] || 0) + 1;
      if (t2Done.length === 2) partnerCounts[pairKey(t2Done[0], t2Done[1])] = (partnerCounts[pairKey(t2Done[0], t2Done[1])] || 0) + 1;
      for (const a of t1Done) {
        for (const b of t2Done) {
          opponentCounts[pairKey(a, b)] = (opponentCounts[pairKey(a, b)] || 0) + 1;
        }
      }
    }
  }

  return newSlots;
}

function filterByGenderMode(
  candidates: string[],
  rosterByName: Record<string, Player>,
  genderMode: string,
  team: (string | null)[],
  teamIdx: number,
  slotIdx: number,
  playersPerTeam: number,
  otherTeam?: (string | null)[],
): string[] {
  if (genderMode === '성별랜덤' || genderMode === '랜덤') return candidates;

  const getGender = (name: string) => rosterByName[name]?.gender || '남';

  if (genderMode === '혼합' || genderMode === '혼합복식' || genderMode === '혼합단식') {
    if (playersPerTeam === 2) {
      // 복식 혼합: 같은 팀 내 남녀 1명씩
      const existing = team.filter((n): n is string => n !== null && n !== '선택');
      if (existing.length > 0) {
        const needed = getGender(existing[0]) === '남' ? '여' : '남';
        return candidates.filter(p => getGender(p) === needed);
      }
    } else if (playersPerTeam === 1 && otherTeam) {
      // 단식 혼합: 상대 팀과 다른 성별
      const otherValid = otherTeam.filter((n): n is string => n !== null && n !== '선택');
      if (otherValid.length > 0) {
        const needed = getGender(otherValid[0]) === '남' ? '여' : '남';
        return candidates.filter(p => getGender(p) === needed);
      }
    }
    return candidates;
  }

  if (genderMode === '동성' || genderMode === '동성복식' || genderMode === '동성단식') {
    if (playersPerTeam === 2) {
      // 복식 동성: 같은 팀 내 같은 성별
      const existing = team.filter((n): n is string => n !== null && n !== '선택');
      if (existing.length > 0) {
        return candidates.filter(p => getGender(p) === getGender(existing[0]));
      }
    } else if (playersPerTeam === 1 && otherTeam) {
      // 단식 동성: 상대와 같은 성별
      const otherValid = otherTeam.filter((n): n is string => n !== null && n !== '선택');
      if (otherValid.length > 0) {
        return candidates.filter(p => getGender(p) === getGender(otherValid[0]));
      }
    }
    return candidates;
  }

  if (genderMode === '남성복식' || genderMode === '남성단식') {
    return candidates.filter(p => getGender(p) === '남');
  }

  if (genderMode === '여성복식' || genderMode === '여성단식') {
    return candidates.filter(p => getGender(p) === '여');
  }

  return candidates;
}

/**
 * 팀별 대진 생성 (팀 간 매칭)
 */
export function buildTeamSchedule(
  players: string[],
  rosterByName: Record<string, Player>,
  teamAssignments: Record<string, string>,
  teamNames: string[],
  gameType: '복식' | '단식',
  totalRounds: number,
  courtCount: number,
  mode: string,
  useNtrp: boolean,
): Match[] {
  // 팀별 선수 분류
  const teamPlayers: Record<string, string[]> = {};
  for (const team of teamNames) {
    teamPlayers[team] = players.filter(p => teamAssignments[p] === team);
  }

  const playersPerTeam = gameType === '단식' ? 1 : 2;
  const matches: Match[] = [];

  // 팀 조합 생성 (2팀씩)
  const teamPairs: [string, string][] = [];
  for (let i = 0; i < teamNames.length; i++) {
    for (let j = i + 1; j < teamNames.length; j++) {
      teamPairs.push([teamNames[i], teamNames[j]]);
    }
  }

  const counts: Record<string, number> = {};
  players.forEach(p => { counts[p] = 0; });

  for (let r = 0; r < totalRounds; r++) {
    const usedInRound = new Set<string>();

    for (let c = 0; c < courtCount; c++) {
      const pair = teamPairs[(r * courtCount + c) % teamPairs.length];
      const pool1 = teamPlayers[pair[0]].filter(p => !usedInRound.has(p));
      const pool2 = teamPlayers[pair[1]].filter(p => !usedInRound.has(p));

      const pickN = (pool: string[], n: number): string[] => {
        // 최소 게임수 그룹 내에서 랜덤 선택 (공정성)
        const sorted = [...pool].sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
        if (sorted.length <= n) return sorted;
        // 같은 게임수끼리는 랜덤 섞기
        const result: string[] = [];
        let remaining = [...sorted];
        for (let k = 0; k < n && remaining.length > 0; k++) {
          const minC = counts[remaining[0]] || 0;
          const tied = remaining.filter(p => (counts[p] || 0) === minC);
          const pick = tied[Math.floor(Math.random() * tied.length)];
          result.push(pick);
          remaining = remaining.filter(p => p !== pick);
        }
        return result;
      };

      const team1 = pickN(pool1, playersPerTeam);
      const team2 = pickN(pool2, playersPerTeam);

      if (team1.length === playersPerTeam && team2.length === playersPerTeam) {
        team1.forEach(p => { usedInRound.add(p); counts[p]++; });
        team2.forEach(p => { usedInRound.add(p); counts[p]++; });
        matches.push({ gameType, team1, team2, court: c + 1 });
      }
    }
  }

  return matches;
}

/**
 * 빈 수동 슬롯 초기화
 */
export function createEmptySlots(
  totalRounds: number,
  courtCount: number,
  gameType: '복식' | '단식',
): ManualSlot[][] {
  const playersPerTeam = gameType === '단식' ? 1 : 2;
  const slots: ManualSlot[][] = [];
  for (let r = 0; r < totalRounds; r++) {
    const round: ManualSlot[] = [];
    for (let c = 0; c < courtCount; c++) {
      round.push({
        team1: Array(playersPerTeam).fill(null),
        team2: Array(playersPerTeam).fill(null),
        checked: false,
      });
    }
    slots.push(round);
  }
  return slots;
}
