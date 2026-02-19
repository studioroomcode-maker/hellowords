/**
 * 대진 분석 유틸리티
 * 당일 대진표를 분석하여 상대 전적, NTRP 밸런스, 파트너 궁합 총평 생성
 */

import { Session, Player, Match } from '../types';
import { getOpponentStats, getPartnerStats } from './stats';
import { calculateDailyStats, findMVP, findUndefeated, countShutouts } from './scoring';

export interface NotableMatchup {
  type: 'nemesis' | 'bestPartner' | 'highWinRate' | 'lowWinRate' | 'firstMeet';
  players: string[];
  stat: string;
}

export interface MatchDayAnalysis {
  totalMatches: number;
  totalPlayers: number;
  ntrpBalance: {
    avgDiff: number;      // 전체 매치 평균 NTRP 차이
    maxDiff: number;      // 최대 NTRP 차이
    verdict: string;      // "균형", "약간 불균형", "큰 차이"
    hasNtrp: boolean;     // NTRP 데이터 존재 여부
  };
  notableMatchups: NotableMatchup[];
  overallVerdict: string; // 오프라인 총평 텍스트
}

// NTRP 조회 헬퍼
function getPlayerNtrp(
  player: Player,
  useAdminNtrp: boolean,
): number | null {
  if (useAdminNtrp && player.adminNtrp != null) return player.adminNtrp;
  return player.ntrp;
}

/**
 * 당일 대진 분석
 */
export function analyzeMatchDay(
  session: Session,
  allSessions: Record<string, Session>,
  players: Player[],
  useAdminNtrp: boolean = false,
): MatchDayAnalysis {
  const matches = session.schedule.filter(m => m.gameType !== '삭제');
  const playerMap = new Map(players.map(p => [p.name, p]));
  const isGuestName = (name: string) => name.startsWith('G') || name.startsWith('게스트_') || name.includes('게스트');

  // 참가 선수 수집 (게스트 제외)
  const allPlayerNames = new Set<string>();
  matches.forEach(m => {
    m.team1.forEach(p => { if (!isGuestName(p)) allPlayerNames.add(p); });
    m.team2.forEach(p => { if (!isGuestName(p)) allPlayerNames.add(p); });
  });

  const totalMatches = matches.length;
  const totalPlayers = allPlayerNames.size;

  // ── 1. NTRP 밸런스 분석 ──
  const ntrpDiffs: number[] = [];
  for (const match of matches) {
    const t1Ntrps = match.team1.map(n => { const p = playerMap.get(n); return p ? getPlayerNtrp(p, useAdminNtrp) : null; }).filter((v): v is number => v != null);
    const t2Ntrps = match.team2.map(n => { const p = playerMap.get(n); return p ? getPlayerNtrp(p, useAdminNtrp) : null; }).filter((v): v is number => v != null);
    if (t1Ntrps.length > 0 && t2Ntrps.length > 0) {
      const t1Avg = t1Ntrps.reduce((a, b) => a + b, 0) / t1Ntrps.length;
      const t2Avg = t2Ntrps.reduce((a, b) => a + b, 0) / t2Ntrps.length;
      ntrpDiffs.push(Math.abs(t1Avg - t2Avg));
    }
  }

  const hasNtrp = ntrpDiffs.length > 0;
  const avgDiff = hasNtrp ? ntrpDiffs.reduce((a, b) => a + b, 0) / ntrpDiffs.length : 0;
  const maxDiff = hasNtrp ? Math.max(...ntrpDiffs) : 0;
  let ntrpVerdict = '균형';
  if (avgDiff > 0.5) ntrpVerdict = '큰 차이';
  else if (avgDiff > 0.2) ntrpVerdict = '약간 차이';

  // ── 2. 상대 전적 & 파트너 궁합 분석 ──
  // 과거 세션에서 전적 데이터 캐시
  const oppStatsCache = new Map<string, Map<string, { games: number; winRate: number }>>();
  const partnerStatsCache = new Map<string, Map<string, { games: number; winRate: number }>>();

  for (const pName of allPlayerNames) {
    // 상대 전적
    const oppStats = getOpponentStats(allSessions, pName);
    const oppMap = new Map<string, { games: number; winRate: number }>();
    for (const os of oppStats) {
      oppMap.set(os.opponent, { games: os.games, winRate: os.winRate });
    }
    oppStatsCache.set(pName, oppMap);

    // 파트너 전적
    const partStats = getPartnerStats(allSessions, pName);
    const partMap = new Map<string, { games: number; winRate: number }>();
    for (const ps of partStats) {
      partMap.set(ps.partner, { games: ps.games, winRate: ps.winRate });
    }
    partnerStatsCache.set(pName, partMap);
  }

  // 오늘 매치별로 주목할 만한 매치업 추출
  const notableMatchups: NotableMatchup[] = [];
  const seenPairs = new Set<string>();

  for (const match of matches) {
    const isDoubles = match.gameType === '복식';

    // 상대 전적 분석 (게스트 제외)
    for (const p1 of match.team1.filter(p => !isGuestName(p))) {
      for (const p2 of match.team2.filter(p => !isGuestName(p))) {
        const pairKey = [p1, p2].sort().join('-');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const record = oppStatsCache.get(p1)?.get(p2);
        if (!record || record.games < 2) {
          if (!record || record.games === 0) {
            // 첫 만남은 너무 많을 수 있으므로 최대 1개만
            if (notableMatchups.filter(n => n.type === 'firstMeet').length < 1) {
              notableMatchups.push({
                type: 'firstMeet',
                players: [p1, p2],
                stat: '첫 대결',
              });
            }
          }
          continue;
        }
        if (record.winRate <= 0.3 && record.games >= 3) {
          notableMatchups.push({
            type: 'nemesis',
            players: [p1, p2],
            stat: `${record.games}전 ${Math.round(record.winRate * 100)}%`,
          });
        } else if (record.winRate >= 0.7 && record.games >= 3) {
          notableMatchups.push({
            type: 'highWinRate',
            players: [p1, p2],
            stat: `${record.games}전 ${Math.round(record.winRate * 100)}%`,
          });
        } else if (record.winRate <= 0.35 && record.games >= 2) {
          notableMatchups.push({
            type: 'lowWinRate',
            players: [p1, p2],
            stat: `${record.games}전 ${Math.round(record.winRate * 100)}%`,
          });
        }
      }
    }

    // 파트너 궁합 분석 (복식만)
    if (isDoubles) {
      const teamPairs: [string, string][] = [];
      if (match.team1.length >= 2) teamPairs.push([match.team1[0], match.team1[1]]);
      if (match.team2.length >= 2) teamPairs.push([match.team2[0], match.team2[1]]);

      for (const [a, b] of teamPairs) {
        if (isGuestName(a) || isGuestName(b)) continue;
        const pairKey = `partner-${[a, b].sort().join('-')}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const record = partnerStatsCache.get(a)?.get(b);
        if (record && record.games >= 3 && record.winRate >= 0.7) {
          notableMatchups.push({
            type: 'bestPartner',
            players: [a, b],
            stat: `${record.games}전 승률 ${Math.round(record.winRate * 100)}%`,
          });
        }
      }
    }
  }

  // 중요도순 정렬 (천적 > 환상궁합 > 고승률 > 저승률 > 첫만남)
  const typePriority: Record<string, number> = {
    nemesis: 0,
    bestPartner: 1,
    highWinRate: 2,
    lowWinRate: 3,
    firstMeet: 4,
  };
  notableMatchups.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

  // 최대 5개만
  const topMatchups = notableMatchups.slice(0, 5);

  // ── 3. 오프라인 총평 생성 ──
  const lines: string[] = [];
  // 시드: 같은 데이터면 같은 결과, 다른 데이터면 다른 결과
  const seed = totalMatches * 7 + totalPlayers * 13 + topMatchups.length * 3;

  // 기본 정보 + 재미 요소
  const openings = [
    `오늘 ${totalPlayers}명의 전사들이 ${totalMatches}경기의 전쟁터에 뛰어듭니다!`,
    `${totalPlayers}명, ${totalMatches}경기! 오늘 코트가 들썩일 예정입니다.`,
    `${totalMatches}판의 승부가 펼쳐집니다! ${totalPlayers}명 모두 각오 단단히!`,
    `코트 위 ${totalPlayers}인의 대격돌! ${totalMatches}경기 풀 패키지입니다.`,
    `${totalPlayers}명의 선수, ${totalMatches}개의 드라마! 오늘 무슨 일이 벌어질까?`,
    `긴장감 넘치는 ${totalMatches}경기! ${totalPlayers}명 중 누가 웃을까?`,
    `오늘의 코트는 콜로세움! ${totalPlayers}명의 검투사가 ${totalMatches}판에 도전합니다.`,
    `${totalMatches}번의 공격과 수비! ${totalPlayers}명 전원 출격 완료!`,
    `두근두근 ${totalMatches}경기! ${totalPlayers}명 선수단, 워밍업 끝났나요?`,
    `오늘의 라인업: ${totalPlayers}명! ${totalMatches}판짜리 블록버스터가 시작됩니다.`,
    `코트에 전운이 감돕니다! ${totalPlayers}명, ${totalMatches}판 풀코스 준비!`,
    `${totalMatches}경기, ${totalPlayers}명! 오늘 코트 위에서 역사가 쓰여집니다.`,
    `선수 입장! ${totalPlayers}명 전원 집결, ${totalMatches}판 대서사시가 열립니다.`,
    `오늘의 메뉴: ${totalMatches}경기 풀코스에 ${totalPlayers}명의 셰프가 요리합니다!`,
    `${totalPlayers}명이 뛰는 ${totalMatches}판! 숨 쉴 틈이 없을 겁니다.`,
    `코트 위 ${totalPlayers}인! ${totalMatches}번의 승부가 기다리고 있습니다!`,
    `자, ${totalMatches}판 시작합니다! ${totalPlayers}명 선수 여러분, 준비됐나요?`,
    `흥분 지수 MAX! ${totalPlayers}명이 ${totalMatches}경기에 모든 걸 건다!`,
    `오늘은 ${totalMatches}편짜리 시리즈물! 주연 ${totalPlayers}명, 엑스트라 없음!`,
    `라켓을 들어라! ${totalPlayers}명, ${totalMatches}판의 전장으로!`,
  ];
  lines.push(openings[seed % openings.length]);

  // NTRP 분석 + 예측
  if (hasNtrp) {
    if (ntrpVerdict === '균형') {
      const balanced = [
        'NTRP가 고르게 잡혀 있어 접전 확률 80%! 뻔한 경기는 없을 겁니다.',
        '실력 균형이 딱 맞습니다! 한 끗 차이 승부가 많을 예감!',
        'NTRP 완벽 밸런스! 오늘은 정신력 싸움이 될 듯합니다.',
        '실력이 비슷비슷! 누가 이길지는 당일 멘탈에 달렸습니다.',
        'NTRP만 보면 팽팽! 승부는 디테일에서 갈릴 겁니다.',
      ];
      lines.push(balanced[(seed + 1) % balanced.length]);
    } else if (ntrpVerdict === '약간 차이') {
      const slight = [
        'NTRP 차이가 살짝 있어 이변 가능성 UP! 약팀의 뒤집기에 주목하세요.',
        '실력차가 살짝! 하지만 테니스는 모르는 거죠. 이변의 냄새가...',
        'NTRP 약간의 차이! 언더독의 반란이 나올까?',
        '살짝 기울어진 운동장이지만, 역전 드라마의 최적 조건이기도!',
        '실력차가 미묘합니다. 이런 날이 역대급 명경기가 나오는 법!',
      ];
      lines.push(slight[(seed + 2) % slight.length]);
    } else {
      const big = [
        'NTRP 갭이 큰 매치 발견! 실력차 극복 드라마가 나올지 주목!',
        '실력 차이가 제법! 하지만 약팀이 이기면 올해의 경기로 등극!',
        'NTRP 격차 주의! 하지만 테니스에는 이변이라는 단어가 있죠.',
        '실력차가 크지만 코트 위에선 아무도 모릅니다. 도전자의 패기가 빛날까?',
        '강자와 도전자의 구도! 다윗 vs 골리앗 경기가 나올 수 있습니다.',
      ];
      lines.push(big[(seed + 3) % big.length]);
    }
  }

  // 주요 매치업 - 5가지 변형
  const nemesisPhrases = [
    (p: string[]) => `⚡ ${p[0]} vs 천적 ${p[1]}! 설욕 가능할까?`,
    (p: string[]) => `⚡ ${p[0]}, ${p[1]}에게 당한 빚을 갚을 때가 왔다!`,
    (p: string[]) => `⚡ ${p[0]}의 악몽 ${p[1]}과 다시 만남! 오늘은 다를까?`,
    (p: string[]) => `⚡ ${p[0]} vs ${p[1]}, 숙명의 라이벌전! 이번엔 누가?`,
    (p: string[]) => `⚡ ${p[0]}, 천적 ${p[1]}을 넘어야 진정한 성장이다!`,
  ];
  const bestPartnerPhrases = [
    (p: string[]) => `🤝 ${p[0]}+${p[1]} 꿈의 듀오 출격! 상대팀 긴장하세요!`,
    (p: string[]) => `🤝 ${p[0]}과 ${p[1]}, 만나기만 하면 승률 폭발! 오늘도 기대!`,
    (p: string[]) => `🤝 ${p[0]}·${p[1]} 조합! 상대팀에겐 공포의 팀!`,
    (p: string[]) => `🤝 환상의 짝꿍 ${p[0]}+${p[1]}! 오늘도 무쌍 찍을까?`,
    (p: string[]) => `🤝 ${p[0]}과 ${p[1]}, 호흡 척척! 오늘 몇 승이나 할까?`,
  ];
  const highWinPhrases = [
    (p: string[]) => `🔥 ${p[0]}이(가) ${p[1]}에게 압도적 우위! 오늘도 먹잇감?`,
    (p: string[]) => `🔥 ${p[0]}, ${p[1]}전에선 거의 무적! 연승 이어질까?`,
    (p: string[]) => `🔥 ${p[0]} vs ${p[1]}, 한쪽이 일방적! 뒤집기 나올까?`,
    (p: string[]) => `🔥 ${p[0]}이 ${p[1]}의 천장! 오늘 깨뜨릴 수 있을까?`,
    (p: string[]) => `🔥 ${p[1]} 입장에서 ${p[0]}은 넘기 힘든 산! 도전!`,
  ];
  const lowWinPhrases = [
    (p: string[]) => `💪 ${p[0]}, ${p[1]}에게 반드시 갚아야 할 빚이 있다!`,
    (p: string[]) => `💪 ${p[0]}의 설욕전! ${p[1]}에게 이번엔 통할까?`,
    (p: string[]) => `💪 ${p[0]}, ${p[1]}한테 매번 지는 건 지겹다! 오늘이 전환점?`,
    (p: string[]) => `💪 ${p[0]} vs ${p[1]}, 지금까지는 일방적! 역습의 날?`,
    (p: string[]) => `💪 ${p[0]}에게 ${p[1]}은 필승 과제! 오늘 클리어 가능?`,
  ];
  const firstMeetPhrases = [
    (p: string[]) => `🆕 ${p[0]} vs ${p[1]}, 역사적인 첫 대결! 누가 선빵을 칠까?`,
    (p: string[]) => `🆕 ${p[0]}과 ${p[1]}, 처음 만나는 신선한 매치업!`,
    (p: string[]) => `🆕 ${p[0]} vs ${p[1]}, 서로를 모르는 미지의 대결!`,
    (p: string[]) => `🆕 ${p[0]}과 ${p[1]}, 첫 만남! 데이터 없는 순수 실력전!`,
    (p: string[]) => `🆕 새로운 라이벌 탄생? ${p[0]} vs ${p[1]} 첫 격돌!`,
  ];

  let matchupSeed = seed;
  for (const mu of topMatchups.slice(0, 3)) {
    matchupSeed += 7;
    switch (mu.type) {
      case 'nemesis':
        lines.push(`${nemesisPhrases[matchupSeed % nemesisPhrases.length](mu.players)} (${mu.stat})`);
        break;
      case 'bestPartner':
        lines.push(`${bestPartnerPhrases[matchupSeed % bestPartnerPhrases.length](mu.players)} (${mu.stat})`);
        break;
      case 'highWinRate':
        lines.push(`${highWinPhrases[matchupSeed % highWinPhrases.length](mu.players)} (${mu.stat})`);
        break;
      case 'lowWinRate':
        lines.push(`${lowWinPhrases[matchupSeed % lowWinPhrases.length](mu.players)} (${mu.stat})`);
        break;
      case 'firstMeet':
        lines.push(`${firstMeetPhrases[matchupSeed % firstMeetPhrases.length](mu.players)}`);
        break;
    }
  }

  // 승부 예측 / 재미 요소
  if (topMatchups.length === 0) {
    const funFacts = [
      '데이터로는 예측 불가! 오늘은 순수 실력과 운의 대결입니다.',
      '전적 데이터가 부족하니, 오늘이 바로 전설의 시작점이 될 수 있습니다!',
      '모두가 비슷한 출발선! 누가 치고 나갈지 두근두근합니다.',
      '과거 전적이 별로 없어요. 오늘부터 역사를 새로 쓰는 겁니다!',
      '데이터? 필요 없다! 오늘의 승부는 현장에서 만들어진다!',
      '전적이 없다는 건 누구나 이길 수 있다는 뜻! 최고의 설렘입니다.',
      '아직 서로를 잘 모르는 상태! 그래서 더 흥미진진합니다.',
      '오늘은 데이터 말고 감이다! 직감이 맞는 사람이 승자!',
      '모든 게 새로운 시작! 여기서 만들어지는 전적이 내일의 데이터입니다.',
      '깨끗한 백지 상태! 첫 획을 긋는 건 누구?',
    ];
    lines.push(funFacts[(seed + 5) % funFacts.length]);
  }

  // 마무리
  const closings = [
    '코트 위 드라마, 오늘도 기대됩니다! 🎬',
    '오늘의 MVP는 과연 누구?! 🏆',
    '예측은 예측일 뿐! 진짜 승부는 코트에서! 🔥',
    '모든 경기가 명승부가 되길! 💥',
    '짜릿한 승부 예감! 폰 충전 완료? 📱',
    '오늘 코트에서 전설이 탄생할 수도?! ⭐',
    '예열 끝! 이제 진검승부입니다! ⚔️',
    '결과는 아무도 모른다! 그게 테니스의 매력! 🎾',
    '오늘의 승자는 끝까지 뛰는 사람! 체력 관리! 💨',
    '명경기의 냄새가 난다! 놓치면 후회할걸요? 👀',
    '라켓에 영혼을 담아라! 오늘이 바로 그날! 🌟',
    '각오 단단히! 오늘의 코트는 만만치 않을 겁니다! 💎',
    '심장 뛰는 승부, 시작합니다! 두근두근! 💓',
    '오늘 경기 후 맥주 한잔이 더 맛있을 겁니다! 🍻',
    '다들 스트레칭 잘 하셨죠? 진짜 시작입니다! 🏃',
  ];
  lines.push(closings[(seed * 3 + totalPlayers) % closings.length]);

  return {
    totalMatches,
    totalPlayers,
    ntrpBalance: { avgDiff, maxDiff, verdict: ntrpVerdict, hasNtrp },
    notableMatchups: topMatchups,
    overallVerdict: lines.join(' '),
  };
}

// ── 경기 결과 분석 ──

export interface ResultDayAnalysis {
  totalMatches: number;
  completedMatches: number;
  totalPlayers: number;
  mvp: { name: string; wins: number; losses: number; draws: number; scoreDiff: number } | null;
  undefeated: string[];
  shutoutLeaders: { name: string; count: number }[];
  closestGame: { team1: string[]; team2: string[]; score: string; gameNum?: number } | null;
  biggestWin: { team1: string[]; team2: string[]; score: string; gameNum?: number } | null;
  overallVerdict: string;
}

/**
 * 당일 경기 결과 분석
 */
export function analyzeResultDay(session: Session): ResultDayAnalysis {
  const matches = session.schedule.filter(m => m.gameType !== '삭제');
  const isGuest = (name: string) => name.startsWith('G') || name.startsWith('게스트_') || name.includes('게스트');

  // 참가 선수 수집 (게스트 제외)
  const allPlayerNames = new Set<string>();
  matches.forEach(m => {
    m.team1.forEach(p => { if (!isGuest(p)) allPlayerNames.add(p); });
    m.team2.forEach(p => { if (!isGuest(p)) allPlayerNames.add(p); });
  });

  const totalMatches = matches.length;
  const totalPlayers = allPlayerNames.size;

  // 완료된 경기
  const completedMatches = matches.filter((_, i) => {
    // 실제 인덱스 찾기 (삭제된 경기 포함)
    const origIdx = session.schedule.indexOf(matches[i]);
    const r = session.results[String(origIdx + 1)];
    return r?.t1 !== null && r?.t1 !== undefined;
  }).length;

  // 통계 계산
  const stats = calculateDailyStats(session);
  const mvpResult = findMVP(stats);
  const undefeated = findUndefeated(stats);
  const shutouts = countShutouts(session);

  // MVP 정보 가공
  const mvp = mvpResult ? {
    name: mvpResult.name,
    wins: mvpResult.stats.wins,
    losses: mvpResult.stats.losses,
    draws: mvpResult.stats.draws,
    scoreDiff: mvpResult.stats.scoreFor - mvpResult.stats.scoreAgainst,
  } : null;

  // 셧아웃 리더
  const shutoutLeaders = Object.entries(shutouts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // 접전/대승 경기 찾기
  let closestGame: ResultDayAnalysis['closestGame'] = null;
  let biggestWin: ResultDayAnalysis['biggestWin'] = null;
  let minDiff = Infinity;
  let maxDiff = 0;
  let activeGameNum = 0;

  for (let idx = 0; idx < session.schedule.length; idx++) {
    const match = session.schedule[idx];
    if (match.gameType === '삭제') continue;
    activeGameNum++;
    const r = session.results[String(idx + 1)];
    if (!r || r.t1 === null || r.t2 === null) continue;

    const diff = Math.abs(r.t1 - r.t2);
    if (diff < minDiff && diff >= 0) {
      minDiff = diff;
      closestGame = { team1: match.team1, team2: match.team2, score: `${r.t1}:${r.t2}`, gameNum: activeGameNum };
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      biggestWin = { team1: match.team1, team2: match.team2, score: `${r.t1}:${r.t2}`, gameNum: activeGameNum };
    }
  }

  // 오프라인 총평 생성
  const lines: string[] = [];
  const rSeed = completedMatches * 11 + totalPlayers * 7 + (mvp ? mvp.wins * 3 : 0);

  if (completedMatches === 0) {
    lines.push('아직 입력된 점수가 없습니다. 첫 점수를 기다리는 중! ⏳');
  } else {
    const openings = [
      `${completedMatches}경기 완료! ${totalPlayers}명이 코트를 불태웠습니다 🔥`,
      `오늘의 전투 기록: ${completedMatches}경기, ${totalPlayers}명의 전사들!`,
      `${totalPlayers}명, ${completedMatches}판의 열전이 펼쳐졌습니다!`,
      `${completedMatches}판 끝! ${totalPlayers}명의 땀과 환호가 코트를 적셨습니다!`,
      `대단합니다! ${completedMatches}경기를 ${totalPlayers}명이 소화했습니다!`,
      `오늘의 스코어보드가 완성되어 갑니다! ${completedMatches}판, ${totalPlayers}명!`,
      `코트의 열기가 가시지 않습니다! ${completedMatches}경기 결과 리포트!`,
      `${totalPlayers}명의 격전! ${completedMatches}경기의 결과가 쏟아집니다!`,
      `뜨거웠습니다! ${completedMatches}경기, ${totalPlayers}명의 파이팅!`,
      `기록은 거짓말을 하지 않는다! ${completedMatches}경기 완주!`,
      `숨 막히는 ${completedMatches}판이 끝났습니다! ${totalPlayers}명 전원 수고했어요!`,
      `결과가 나왔습니다! ${completedMatches}경기, ${totalPlayers}명의 승부!`,
      `오늘의 하이라이트! ${totalPlayers}명이 뛴 ${completedMatches}경기!`,
      `코트 위 드라마 ${completedMatches}편 완결! 주연 ${totalPlayers}명!`,
      `${completedMatches}판의 기록이 역사에 남습니다! ${totalPlayers}명 모두 주인공!`,
    ];
    lines.push(openings[rSeed % openings.length]);

    if (mvp) {
      const diffStr = mvp.scoreDiff > 0 ? `+${mvp.scoreDiff}` : `${mvp.scoreDiff}`;
      const mvpComments = [
        `🏆 오늘의 MVP ${mvp.name}! ${mvp.wins}승 ${mvp.draws}무 ${mvp.losses}패, 득실차 ${diffStr}로 코트를 지배!`,
        `👑 ${mvp.name} 대활약! ${mvp.wins}승 ${mvp.losses}패(득실차 ${diffStr})로 오늘의 주인공 등극!`,
        `🌟 ${mvp.name}이(가) ${mvp.wins}승 ${mvp.losses}패 득실차 ${diffStr}로 MVP 왕좌에! 상대들 눈물😢`,
        `🥇 ${mvp.name}, ${mvp.wins}승 ${mvp.losses}패 득실차 ${diffStr}! 인간 테니스 머신!`,
        `⭐ MVP ${mvp.name}! ${mvp.wins}승 ${mvp.losses}패(${diffStr}) — 오늘 코트의 절대 강자!`,
        `🔥 ${mvp.name} 폭주! ${mvp.wins}승 ${mvp.losses}패, 득실차 ${diffStr}! 상대가 불쌍해지는 레벨.`,
        `🎯 ${mvp.name}, ${mvp.wins}승으로 MVP! 득실차 ${diffStr}의 완벽한 하루!`,
        `💎 오늘의 보석 ${mvp.name}! ${mvp.wins}승 ${mvp.draws}무 ${mvp.losses}패, 빈틈 없는 경기력!`,
        `🦁 사자 ${mvp.name}! ${mvp.wins}승 ${mvp.losses}패(${diffStr}), 먹이사슬 꼭대기에서 포효!`,
        `🏅 ${mvp.name} MVP! ${mvp.wins}승에 득실차 ${diffStr}! 다음엔 누가 이 기록을 깰까?`,
      ];
      lines.push(mvpComments[(rSeed + mvp.wins) % mvpComments.length]);
    }

    if (undefeated.length > 0 && undefeated.length <= 3) {
      const undefOne = [
        `🛡️ ${undefeated[0]}, 오늘 무패! 누구도 막지 못한 철벽!`,
        `🛡️ ${undefeated[0]}은 오늘 절대 지지 않았다! 무패 행진!`,
        `🛡️ ${undefeated[0]}, 패배를 모르는 하루! 강철 멘탈!`,
        `🛡️ 무패의 사나이(여인) ${undefeated[0]}! 오늘 코트의 최후 생존자!`,
        `🛡️ ${undefeated[0]}, 단 한 번도 안 졌다! 무적의 하루!`,
      ];
      const undefMulti = [
        `🛡️ 무패 클럽: ${undefeated.join(', ')} — 오늘 지지 않은 자들!`,
        `🛡️ ${undefeated.join(', ')} — 무패 달성! 오늘의 철벽 군단!`,
        `🛡️ 패배 거부 선언! ${undefeated.join(', ')} 전원 무패!`,
        `🛡️ ${undefeated.join('+')} 무패 파티! 이 조합 무서운데...?`,
        `🛡️ 오늘 안 진 사람들: ${undefeated.join(', ')}. 비결이 뭐예요?`,
      ];
      if (undefeated.length === 1) {
        lines.push(undefOne[(rSeed + 2) % undefOne.length]);
      } else {
        lines.push(undefMulti[(rSeed + 2) % undefMulti.length]);
      }
    }

    if (closestGame && minDiff <= 1) {
      const gn = closestGame.gameNum ? `${closestGame.gameNum}번 경기 ` : '';
      const closePhrases = [
        `😱 ${gn}${closestGame.score} 초접전! 심장이 쫄깃한 명승부였습니다!`,
        `🫀 ${gn}${closestGame.score} 짜릿한 접전! 보는 사람도 숨이 멎을 뻔!`,
        `😤 ${gn}${closestGame.score}! 한 끗 차이! 이런 게 진짜 명경기!`,
        `💓 ${gn}${closestGame.score} 초박빙 승부! 재경기를 원하는 목소리가...`,
        `⚡ ${gn}${closestGame.score} 접전의 백미! 두 팀 모두에게 박수를!`,
      ];
      lines.push(closePhrases[(rSeed + 3) % closePhrases.length]);
    }

    if (biggestWin && maxDiff >= 4) {
      const gn = biggestWin.gameNum ? `${biggestWin.gameNum}번 경기 ` : '';
      const bigPhrases = [
        `💀 ${gn}${biggestWin.score} 대학살! 이건 경기가 아니라 수업이었다...`,
        `🌪️ ${gn}${biggestWin.score} 폭풍! 이건 경기가 아니라 시범이었나?`,
        `📚 ${gn}${biggestWin.score} 완파! 코트 위 교실 수업이 열렸습니다.`,
        `😵 ${gn}${biggestWin.score}! 상대팀 멘탈 수리비 청구 예정...`,
        `🚀 ${gn}${biggestWin.score} 로켓 발사! 한쪽이 궤도를 이탈했습니다!`,
      ];
      lines.push(bigPhrases[(rSeed + 4) % bigPhrases.length]);
    }

    if (shutoutLeaders.length > 0 && shutoutLeaders[0].count >= 2) {
      const shutPhrases = [
        `🚫 ${shutoutLeaders[0].name}, 셧아웃 ${shutoutLeaders[0].count}회! 상대에게 1점도 안 줌!`,
        `🔒 ${shutoutLeaders[0].name}의 철문! ${shutoutLeaders[0].count}번이나 상대를 0점으로!`,
        `🧱 ${shutoutLeaders[0].name}, ${shutoutLeaders[0].count}회 셧아웃! 벽을 만났다고 생각하세요.`,
        `❌ ${shutoutLeaders[0].name}, 상대에게 점수를 주지 않는 남자(여자)! ${shutoutLeaders[0].count}회!`,
        `🏰 ${shutoutLeaders[0].name}의 요새! ${shutoutLeaders[0].count}번 셧아웃, 난공불락!`,
      ];
      lines.push(shutPhrases[(rSeed + 5) % shutPhrases.length]);
    }

    if (completedMatches < totalMatches) {
      const remaining = totalMatches - completedMatches;
      const remainPhrases = [
        `아직 ${remaining}경기 남았습니다! 역전 드라마는 지금부터! 💪`,
        `${remaining}경기 더 남았어요! 아직 끝나지 않은 이야기! ⏳`,
        `잠깐, ${remaining}판이 더 있다! MVP가 바뀔 수도?! 🔄`,
        `남은 ${remaining}경기가 판도를 뒤집을 수 있습니다! 방심 금물!`,
        `${remaining}경기 남음! 후반전에 진짜 드라마가 나올 수도?!`,
      ];
      lines.push(remainPhrases[(rSeed + 6) % remainPhrases.length]);
    } else {
      const closings = [
        '모두 수고하셨습니다! 다음 경기에서 또 만나요! 🤝',
        '알찬 하루! 오늘의 기록이 내일의 전설이 됩니다 📖',
        '경기는 끝났지만 여운은 남는다! 다음이 더 기대됩니다 🎯',
        '모든 경기가 드라마였습니다! 오늘도 열정 만세! 🙌',
        '수고하셨습니다! 오늘의 나보다 내일의 내가 더 강해질 겁니다! 💪',
        '완벽한 하루! 이런 날이 있어 테니스를 하는 거죠! 🌈',
        '오늘의 점수가 내일의 동기부여! 다음에 더 세게! 🔥',
        '모두 최선을 다했습니다! 그 자체로 이미 승리! 🏆',
        '끝! 오늘 통계 보면서 맥주 한잔 어떠세요? 🍻',
        '고생하셨습니다! 내일은 더 짜릿한 경기가 될 거예요! ⚡',
        '오늘의 패배는 내일의 승리를 위한 밑거름! 화이팅! 🌱',
        '경기 끝! 스트레칭 꼭 하시고, 다음 코트에서 만나요! 🧘',
        '대단한 하루였습니다! 이 기록, 잊지 못할 거예요! ✨',
        '모든 선수에게 박수! 코트에 선 것 자체가 승리! 👏',
        '오늘의 라이벌이 내일의 파트너! 테니스의 매력! 🤜🤛',
      ];
      lines.push(closings[(rSeed * 2 + totalPlayers) % closings.length]);
    }
  }

  return {
    totalMatches,
    completedMatches,
    totalPlayers,
    mvp,
    undefeated,
    shutoutLeaders,
    closestGame,
    biggestWin,
    overallVerdict: lines.join(' '),
  };
}
