/**
 * Gemini AI 서비스
 * 동물 프로필, 대진 분석, 경기 총평, 개인 대진 분석
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 프롬프트 버전 - 프롬프트 변경 시 bump하면 캐시 무효화됨
const PROMPT_VERSION = 'v2';

// ── API 키 테스트 ──

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '테니스를 한 단어로 표현하면?' }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 400 || response.status === 403) {
        return { ok: false, message: `API 키가 유효하지 않습니다. (${response.status})` };
      }
      if (response.status === 429) {
        const detail = errText.includes('RESOURCE_EXHAUSTED') ? '일일 할당량 초과'
          : errText.includes('RATE_LIMIT') ? '분당 요청 초과 (1~2분 후 재시도)'
          : errText.slice(0, 150);
        return { ok: true, message: `API 키 유효! 할당량 초과: ${detail}` };
      }
      return { ok: false, message: `API 오류 (${response.status}): ${errText.slice(0, 150)}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return { ok: true, message: `API 키 정상! 응답: "${text.trim().slice(0, 30)}"` };
    }
    return { ok: false, message: '응답이 비어있습니다.' };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { ok: false, message: '시간 초과 (8초). 네트워크를 확인해주세요.' };
    }
    return { ok: false, message: `연결 실패: ${e?.message || '알 수 없는 오류'}` };
  }
}

interface AnimalProfileInput {
  winRate: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  avgScoreFor: number;
  avgScoreAgainst: number;
  scoreDiff: number;
  longestWinStreak: number;
  longestLossStreak: number;
  recentForm: ('W' | 'L' | 'D')[];
  bestPartnerName?: string;
  bestPartnerWinRate?: number;
  nemesisName?: string;
  nemesisWinRate?: number;
  attendanceDays?: number;
  mvpCount?: number;
}

interface AnimalProfile {
  emoji: string;
  animal: string;
  title: string;
  description: string;
}

const CACHE_KEY_PREFIX = '@tennis_animal_ai_';

// 통계 해시 생성 (캐시 무효화용)
function statsHash(input: AnimalProfileInput): string {
  return `${PROMPT_VERSION}-${input.games}-${input.wins}-${input.losses}-${input.draws}-${input.mvpCount || 0}`;
}

// 캐시 키 생성
function cacheKey(clubCode: string, playerName: string): string {
  return `${CACHE_KEY_PREFIX}${clubCode}_${playerName}`;
}

// 캐시에서 프로필 로드
async function getCachedProfile(
  clubCode: string,
  playerName: string,
  currentHash: string,
): Promise<AnimalProfile | null> {
  try {
    const stored = await AsyncStorage.getItem(cacheKey(clubCode, playerName));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.hash !== currentHash) return null;
    return parsed.profile as AnimalProfile;
  } catch {
    return null;
  }
}

// 캐시에 프로필 저장
async function setCachedProfile(
  clubCode: string,
  playerName: string,
  hash: string,
  profile: AnimalProfile,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(clubCode, playerName),
      JSON.stringify({ hash, profile, timestamp: Date.now() }),
    );
  } catch {
    // 캐시 저장 실패 무시
  }
}

// Gemini API 호출
export async function generateAnimalProfileAI(
  apiKey: string,
  playerName: string,
  input: AnimalProfileInput,
  clubCode: string,
): Promise<AnimalProfile | null> {
  const hash = statsHash(input);

  // 1. 캐시 확인
  const cached = await getCachedProfile(clubCode, playerName, hash);
  if (cached) return cached;

  // 2. Gemini API 호출
  console.log('[Gemini animal] Calling API for', playerName, 'key:', apiKey.slice(0, 6) + '...');
  try {
    const recentFormStr = input.recentForm.length > 0
      ? input.recentForm.map(r => r === 'W' ? '승' : r === 'L' ? '패' : '무').join(' → ')
      : '기록 없음';

    const prompt = `당신은 "동물의 왕국" 내레이터입니다. 테니스 코트를 야생 사바나처럼 묘사하세요!
선수를 동물에 빗대어 마치 내셔널 지오그래픽 다큐멘터리 해설처럼 재미있고 생생하게 표현해주세요.
절대로 "승률 XX%, N승 M패" 같은 단순 통계 나열을 하지 마세요. 이야기로 풀어주세요!

선수명: ${playerName}
통계:
- 총 ${input.games}경기 (${input.wins}승 ${input.draws}무 ${input.losses}패)
- 승률: ${(input.winRate * 100).toFixed(1)}%
- 평균 득점 ${input.avgScoreFor.toFixed(1)} / 실점 ${input.avgScoreAgainst.toFixed(1)}
- 득실차: ${input.scoreDiff > 0 ? '+' : ''}${input.scoreDiff.toFixed(1)}
- 최다 연승: ${input.longestWinStreak}회 / 최다 연패: ${input.longestLossStreak}회
- 최근 경기 흐름: ${recentFormStr}
- MVP 횟수: ${input.mvpCount || 0}회
- 출석일수: ${input.attendanceDays || 0}일
${input.bestPartnerName ? `- 베스트 파트너: ${input.bestPartnerName} (함께할 때 승률 ${(input.bestPartnerWinRate! * 100).toFixed(0)}%)` : ''}
${input.nemesisName ? `- 천적: ${input.nemesisName} (상대할 때 승률 ${(input.nemesisWinRate! * 100).toFixed(0)}%)` : ''}

규칙:
1. 반드시 실제 동물 하나에 비유 (통계 패턴에 맞는 동물 선택!)
   - 고승률+고득점 → 맹수류 (사자, 호랑이, 매 등)
   - 꾸준한 출석+안정적 성적 → 부지런한 동물 (개미, 벌, 비버 등)
   - 연승 기록 → 질주형 (치타, 매, 독수리 등)
   - 연패 후 반등 → 불사조, 고양이(9개의 목숨) 등
   - 파트너 의존적 → 늑대(팩사냥), 돌고래(팀플레이) 등
2. 이모지는 해당 동물 이모지 1개만
3. 칭호: 재미있고 참신하게, "코트 위의 ○○" 패턴 등 (8자 이내)
4. 설명은 6~8문장, 각 문장에 이모지 1개 포함, "동물의 왕국" 다큐 내레이션 톤:
   - 🌍 오프닝: "테니스 코트라는 정글에 한 마리 [동물]이 나타났습니다..." 느낌
   - 🔥 사냥 본능: 승률/득점을 동물의 사냥 성공률에 비유 (예: "사냥 성공률 ${(input.winRate * 100).toFixed(0)}%! 이 정글의 최상위 포식자!")
   - ⚡ 전설의 순간: 연승/MVP를 드라마틱하게 (예: "${input.longestWinStreak}연승의 질주! 코트가 그의 영토였다!")
   - 📈 최근 컨디션: 최근 폼을 동물 행동에 비유 (예: "최근 ${recentFormStr}... 먹잇감을 놓치지 않는 날카로운 눈빛!")
   - 🤝 베파/천적 반드시 포함 (있을 경우):
     · 베파: "${input.bestPartnerName}과(와) 콤비를 이루면 승률 ${input.bestPartnerWinRate ? (input.bestPartnerWinRate * 100).toFixed(0) : '?'}%! 자연계 최강의 공생 관계!" 식으로
     · 천적: "${input.nemesisName}... 이 이름만 들으면 본능적으로 경계 모드! 승률 ${input.nemesisWinRate ? (input.nemesisWinRate * 100).toFixed(0) : '?'}%의 천적!" 식으로
   - 🏆 클로징: 앞으로의 진화/성장 기대 (예: "이 [동물]의 진화는 아직 끝나지 않았다!")
5. 핵심: 수치를 동물 비유에 자연스럽게 녹여야 함. 절대 "승률 XX%입니다" 같은 보고서 톤 금지!
6. 매번 완전히 다른 동물, 다른 표현, 다른 스토리라인
7. 한국어로 작성

다음 JSON 형식으로만 응답:
{"emoji":"동물이모지","animal":"동물이름","title":"칭호","description":"설명"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 1.2,
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Gemini animal] API error:', response.status, await response.text().catch(() => ''));
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[Gemini animal] Empty response:', JSON.stringify(data).slice(0, 200));
      return null;
    }

    const profile: AnimalProfile = JSON.parse(text);

    // 유효성 검증
    if (!profile.emoji || !profile.animal || !profile.title || !profile.description) {
      return null;
    }

    // 3. 캐시 저장
    await setCachedProfile(clubCode, playerName, hash, profile);

    return profile;
  } catch (e) {
    console.warn('[Gemini animal] Error:', e);
    return null;
  }
}

// ── 대진 분석 AI ──

interface MatchAnalysisResult {
  title: string;
  summary: string;
}

const ANALYSIS_CACHE_PREFIX = '@tennis_match_analysis_';

function analysisCacheKey(clubCode: string, dateStr: string): string {
  return `${ANALYSIS_CACHE_PREFIX}${clubCode}_${dateStr}`;
}

export async function generateMatchAnalysisAI(
  apiKey: string,
  analysisData: {
    totalMatches: number;
    totalPlayers: number;
    ntrpBalance: { avgDiff: number; maxDiff: number; verdict: string; hasNtrp: boolean };
    notableMatchups: { type: string; players: string[]; stat: string }[];
    overallVerdict: string;
  },
  clubCode: string,
  dateStr: string,
): Promise<MatchAnalysisResult | null> {
  const hash = `${PROMPT_VERSION}-${analysisData.totalMatches}-${analysisData.totalPlayers}-${analysisData.notableMatchups.length}`;

  // 캐시 확인
  try {
    const stored = await AsyncStorage.getItem(analysisCacheKey(clubCode, dateStr));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.hash === hash) return parsed.result as MatchAnalysisResult;
    }
  } catch {}

  console.log('[Gemini matchAnalysis] Calling API, key:', apiKey.slice(0, 6) + '...');
  try {
    // 매치업 정보 텍스트 변환
    const matchupLines = analysisData.notableMatchups.map(mu => {
      const typeLabel: Record<string, string> = {
        nemesis: '천적 대결',
        bestPartner: '환상 파트너',
        highWinRate: '강세 매치업',
        lowWinRate: '설욕전',
        firstMeet: '첫 대결',
      };
      return `- ${typeLabel[mu.type] || mu.type}: ${mu.players.join(' vs ')} (${mu.stat})`;
    }).join('\n');

    const ntrpInfo = analysisData.ntrpBalance.hasNtrp
      ? `NTRP 밸런스: 평균 차이 ${analysisData.ntrpBalance.avgDiff.toFixed(2)}, 최대 차이 ${analysisData.ntrpBalance.maxDiff.toFixed(2)} (${analysisData.ntrpBalance.verdict})`
      : 'NTRP 정보 없음';

    const prompt = `당신은 전설적인 테니스 클럽 전담 해설가 "김캐스터"입니다.
마치 UFC 프리뷰, 프로야구 하이라이트, 넷플릭스 스포츠 다큐 내레이션을 섞은 스타일로!
절대로 단순한 통계 나열("총 N경기, N명 참가")을 하지 마세요. 스토리텔링으로 풀어주세요.

대진 정보:
- 총 ${analysisData.totalMatches}경기, ${analysisData.totalPlayers}명 참가
- ${ntrpInfo}

주요 매치업:
${matchupLines || '- 특별한 매치업 없음'}

규칙:
1. title: 영화 제목처럼! (15자 이내, 예: "복수의 칼날 🗡️", "코트 위의 전쟁", "운명의 리매치")
2. summary: 6~8문장, 매 문장에 이모지 1개씩 포함:
   - 🎬 오프닝: "코트에 긴장감이 흐릅니다..." 같은 내레이션 톤으로 시작
   - 🔥 핵심 빅매치: 선수 이름을 반드시 넣고, 드라마틱한 비유 사용 (예: "OOO과 OOO의 숙명의 대결! 전적 3승 5패, 오늘은 설욕할 수 있을까?")
   - ⚡ 주목 포인트: 천적 대결이면 "공포의 상성", 환상 파트너면 "꿈의 콤비 결성!", 첫 대결이면 "미지의 강적 등장!"
   - 🎯 대담한 예측: "오늘의 다크호스는 단연 OOO!" 또는 "MVP 후보 1순위는 OOO"
   - 🏆 클로징: 짧고 강렬한 펀치라인 (예: "과연 누가 웃을 것인가? 코트가 답을 줄 것이다!")
3. 중요: 단순 사실 나열 금지! 반드시 감정, 비유, 스토리가 있어야 함
4. 선수 이름은 최대한 많이 언급
5. 한국어로 작성

다음 JSON 형식으로만 응답:
{"title":"제목","summary":"총평"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 1.0,
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Gemini matchAnalysis] API error:', response.status, await response.text().catch(() => ''));
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[Gemini matchAnalysis] Empty response:', JSON.stringify(data).slice(0, 200));
      return null;
    }

    const result: MatchAnalysisResult = JSON.parse(text);
    if (!result.title || !result.summary) return null;

    // 캐시 저장
    try {
      await AsyncStorage.setItem(
        analysisCacheKey(clubCode, dateStr),
        JSON.stringify({ hash, result, timestamp: Date.now() }),
      );
    } catch {}

    return result;
  } catch (e) {
    console.warn('[Gemini matchAnalysis] Error:', e);
    return null;
  }
}

// ── 경기 결과 분석 AI ──

interface ResultAnalysisResult {
  title: string;
  summary: string;
}

const RESULT_CACHE_PREFIX = '@tennis_result_analysis_';

function resultCacheKey(clubCode: string, dateStr: string): string {
  return `${RESULT_CACHE_PREFIX}${clubCode}_${dateStr}`;
}

export async function generateResultAnalysisAI(
  apiKey: string,
  resultData: {
    totalMatches: number;
    completedMatches: number;
    totalPlayers: number;
    mvp: { name: string; wins: number; losses: number; draws: number; scoreDiff: number } | null;
    undefeated: string[];
    shutoutLeaders: { name: string; count: number }[];
    closestGame: { team1: string[]; team2: string[]; score: string } | null;
    biggestWin: { team1: string[]; team2: string[]; score: string } | null;
    overallVerdict: string;
  },
  clubCode: string,
  dateStr: string,
): Promise<ResultAnalysisResult | null> {
  const hash = `${PROMPT_VERSION}-${resultData.completedMatches}-${resultData.mvp?.name || 'none'}-${resultData.totalPlayers}`;

  // 캐시 확인
  try {
    const stored = await AsyncStorage.getItem(resultCacheKey(clubCode, dateStr));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.hash === hash) return parsed.result as ResultAnalysisResult;
    }
  } catch {}

  console.log('[Gemini resultAnalysis] Calling API, key:', apiKey.slice(0, 6) + '...');
  try {
    const mvpLine = resultData.mvp
      ? `MVP: ${resultData.mvp.name} (${resultData.mvp.wins}승 ${resultData.mvp.draws}무 ${resultData.mvp.losses}패, 득실차 ${resultData.mvp.scoreDiff > 0 ? '+' : ''}${resultData.mvp.scoreDiff})`
      : 'MVP 없음';

    const undefeatedLine = resultData.undefeated.length > 0
      ? `무패 선수: ${resultData.undefeated.join(', ')}`
      : '무패 선수 없음';

    const shutoutLine = resultData.shutoutLeaders.length > 0
      ? `셧아웃 리더: ${resultData.shutoutLeaders.map(s => `${s.name}(${s.count}회)`).join(', ')}`
      : '';

    const closestLine = resultData.closestGame
      ? `접전 경기: ${resultData.closestGame.team1.join(',')} vs ${resultData.closestGame.team2.join(',')} (${resultData.closestGame.score})`
      : '';

    const biggestLine = resultData.biggestWin
      ? `대승 경기: ${resultData.biggestWin.team1.join(',')} vs ${resultData.biggestWin.team2.join(',')} (${resultData.biggestWin.score})`
      : '';

    const prompt = `당신은 "김캐스터" - 전설적인 테니스 클럽 전담 스포츠 하이라이트 해설가입니다.
오늘 경기 결과를 마치 SBS 스포츠 뉴스 클로징, 유튜브 하이라이트 영상 나레이션처럼 작성하세요!
절대로 "총 N경기 진행, N명 참가" 같은 단순 통계 나열을 하지 마세요.

경기 결과 데이터:
- ${resultData.completedMatches}/${resultData.totalMatches}경기 완료, ${resultData.totalPlayers}명
- ${mvpLine}
- ${undefeatedLine}
${shutoutLine ? `- ${shutoutLine}` : ''}
${closestLine ? `- ${closestLine}` : ''}
${biggestLine ? `- ${biggestLine}` : ''}

규칙:
1. title: 헤드라인 뉴스처럼! (15자 이내, 예: "OOO, 코트를 지배하다 👑", "전승 신화의 탄생")
2. summary: 6~8문장, 매 문장에 이모지 포함:
   - 🏟️ 오프닝: 분위기를 실감나게 (예: "오늘 코트는 뜨거웠습니다!")
   - 👑 MVP 스포트라이트: 이름 + 구체적 성적 + 재치있는 별명/비유 (예: "OOO, 오늘 그의 라켓은 마법봉이었다! N승 무패로 코트를 장악했습니다")
   - ⚔️ 명장면: 접전 경기를 영화 장면처럼 묘사 (예: "OOO vs OOO, 6:5의 숨 막히는 접전! 마지막 포인트에서 관중석이 들썩였다")
   - 💀 대승/셧아웃이 있으면 유머러스하게 (예: "이건 경기가 아니라 일방적 수업이었습니다...")
   - 🌟 무패/서프라이즈 선수 조명
   - 🎤 클로징: 강렬한 한마디 (예: "다음 주, 누가 이 기록을 깨뜨릴 것인가!")
3. 핵심: 선수 이름을 많이 쓰고, 각 선수에게 재미있는 수식어를 붙여주세요
4. 단순 사실 나열 금지! 감정과 스토리가 있어야 합니다
5. 한국어로 작성

다음 JSON 형식으로만 응답:
{"title":"제목","summary":"총평"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 1.0,
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Gemini resultAnalysis] API error:', response.status, await response.text().catch(() => ''));
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[Gemini resultAnalysis] Empty response:', JSON.stringify(data).slice(0, 200));
      return null;
    }

    const result: ResultAnalysisResult = JSON.parse(text);
    if (!result.title || !result.summary) return null;

    // 캐시 저장
    try {
      await AsyncStorage.setItem(
        resultCacheKey(clubCode, dateStr),
        JSON.stringify({ hash, result, timestamp: Date.now() }),
      );
    } catch {}

    return result;
  } catch (e) {
    console.warn('[Gemini resultAnalysis] Error:', e);
    return null;
  }
}

// ── 개인 대진 분석 AI ──

const PERSONAL_CACHE_PREFIX = '@tennis_personal_analysis_';

export async function generatePersonalMatchAnalysisAI(
  apiKey: string,
  playerName: string,
  offlineAnalysis: string,
  matchDetails: { matchNum: number; opponents: string[]; partners: string[]; oppRecords: string[]; partRecords: string[] }[],
  totalMatches: number,
  clubCode: string,
  dateStr: string,
): Promise<string | null> {
  const hash = `${PROMPT_VERSION}-${playerName}-${totalMatches}-${matchDetails.length}`;

  // 캐시 확인
  const cKey = `${PERSONAL_CACHE_PREFIX}${clubCode}_${dateStr}_${playerName}`;
  try {
    const stored = await AsyncStorage.getItem(cKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.hash === hash) return parsed.result as string;
    }
  } catch {}

  console.log('[Gemini personal] Calling API for', playerName);
  try {
    const matchLines = matchDetails.map(m => {
      const parts = [];
      parts.push(`${m.matchNum}경기: vs ${m.opponents.join(',')}${m.partners.length ? ` (파트너: ${m.partners.join(',')})` : ''}`);
      if (m.oppRecords.length) parts.push(`  상대전적: ${m.oppRecords.join(', ')}`);
      if (m.partRecords.length) parts.push(`  파트너궁합: ${m.partRecords.join(', ')}`);
      return parts.join('\n');
    }).join('\n');

    const prompt = `당신은 ${playerName} 선수의 전담 코치 "AI코치"입니다.
오늘 대진을 보고, 마치 복싱 경기 전 코너에서 선수에게 귓속말하듯 분석해주세요!
단순 통계 나열이 아닌, 생생한 스토리텔링과 전략적 조언을 해주세요.

오늘 ${playerName}의 경기:
${matchLines}

규칙:
1. 각 경기를 2~3줄로 분석 (이모지 + 경기번호 포함):
   - 천적(승률 낮음)이면:
     "⚡ X경기: OOO... 이름만 들어도 긴장되죠? 전적 N승 M패로 밀리지만, 약점이 있어요! [구체적 전략 조언]"
   - 먹잇감(승률 높음)이면:
     "😎 X경기: OOO 상대로는 자신감 200%! 승률 NN%의 여유, 하지만 방심은 금물!"
   - 호각이면:
     "🔥 X경기: OOO과의 빅매치! 전적 호각, 오늘의 컨디션이 승부를 가른다!"
   - 첫 대결이면:
     "🆕 X경기: OOO, 아직 데이터가 없는 미지의 강적! 첫 인상을 강하게 남기세요!"
   - 파트너가 좋으면: "파트너 OOO과 함께하면 승률 NN%! 꿈의 콤비!" 추가
2. 📊 종합 예측 (2줄):
   - 가장 힘든 경기 vs 가장 유리한 경기 지목
   - 대담한 승패 예측 (예: "3승 1패 예상!")
3. 💪 응원 메시지 (1줄): 선수가 웃을 수 있는 유쾌한 한마디
4. 줄바꿈(\\n)으로 구분
5. 한국어, 순수 텍스트로만 응답 (JSON 아님)`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.1 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Gemini personal] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const result = text.trim();

    // 캐시 저장
    try {
      await AsyncStorage.setItem(cKey, JSON.stringify({ hash, result, timestamp: Date.now() }));
    } catch {}

    return result;
  } catch (e) {
    console.warn('[Gemini personal] Error:', e);
    return null;
  }
}

// ── 사진 점수 인식 (Vision API) ──

export interface ScoreRecognitionMatch {
  matchNumber: number;
  team1Score: number | null;
  team2Score: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScoreRecognitionResult {
  matches: ScoreRecognitionMatch[];
  rawText?: string;
}

export async function recognizeScoresFromImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  matchContext: { matchNumber: number; team1: string[]; team2: string[] }[],
): Promise<ScoreRecognitionResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    console.log('[Gemini Vision] Image size:', Math.round(imageBase64.length / 1024), 'KB, mimeType:', mimeType);
    console.log('[Gemini Vision] Match context:', matchContext.length, 'matches');

    // 전체 선수명 목록 추출
    const allPlayerNames = new Set<string>();
    matchContext.forEach(m => {
      m.team1.forEach(p => allPlayerNames.add(p));
      m.team2.forEach(p => allPlayerNames.add(p));
    });

    const matchList = matchContext.map(m =>
      `${m.matchNumber}번: [팀1] ${m.team1.join(', ')}  vs  [팀2] ${m.team2.join(', ')}`
    ).join('\n');

    const prompt = `이 사진은 테니스 동호회 경기 점수 기록지/점수판 사진입니다.

## 점수 기록지 형식 (자동 감지)
다양한 형식일 수 있습니다:

### 형식A: 경기별 기록
- 각 행이 하나의 경기 (팀A vs 팀B = 점수)

### 형식B: 선수별 라운드 기록 (한울AA, KDK 등)
- 각 행이 한 선수(또는 한 팀), 열이 라운드/게임 번호 (1R, 2R, 3R... 또는 1세트, 2세트...)
- 각 칸은 "X:Y" (X=내 득점, Y=상대 득점)
- 페어링 배정표가 함께 있을 수 있음
- 같은 팀 선수는 동일 점수, 상대 팀은 반대 점수

### 형식C: 리그전 교차표 (라운드로빈)
- 행과 열 모두 팀(또는 선수) 이름
- 교차점 셀에 해당 두 팀의 대전 점수 "X:Y"
- 대각선(자기 vs 자기)은 빈칸 또는 사선(/)
- 예: 행="강석우,송지효" 열="송가인,박지영" 셀="6:3" → 강석우팀 6, 송가인팀 3
- 조(1조,2조,3조...)별로 나뉘어 있을 수 있음

### 형식D: 기타 (칠판, 화이트보드, 손글씨, 자유 형식)

## 등록된 선수 이름 목록
${[...allPlayerNames].join(', ')}

## 앱에 등록된 대진표 (${matchContext.length}경기)
${matchList}

## 작업 순서
1단계: 사진의 형식을 파악하세요 (형식A/B/C/D).
2단계: 사진에 보이는 모든 선수 이름과 점수를 읽으세요.
3단계: 대진표의 각 경기에 해당하는 점수를 찾으세요.

### 형식B 매칭법:
- 팀1 선수의 행에서 올바른 라운드 열을 찾아 점수를 읽습니다
- 올바른 열: 팀1선수 "6:4"인 열과 팀2선수 "4:6"인 열이 같은 열
- 또는 페어링 표에서 선수 번호 조합으로 게임 번호 확인
- team1Score = 팀1 선수의 X값, team2Score = Y값

### 형식C 매칭법:
- 대진표의 팀1 선수를 행(또는 열)에서 찾고, 팀2 선수를 열(또는 행)에서 찾습니다
- 교차 셀의 "X:Y"에서: 행 팀 기준 X=행팀 점수, Y=열팀 점수
- team1이 행에 있으면 team1Score=X, team2Score=Y
- team1이 열에 있으면 team1Score=Y, team2Score=X

4단계: 결과를 JSON으로 정리하세요.

## 점수 규칙
- 점수는 0~10 범위 정수
- 읽기 어렵거나 불확실하면 confidence를 "low"
- 인식 불가한 경기는 생략
- rawText에: 감지 형식 + 읽은 선수명/점수 요약

## JSON 응답 형식
{"matches":[{"matchNumber":1,"team1Score":6,"team2Score":4,"confidence":"high"}],"rawText":"형식C(리그전교차표) 감지. 1조: 강석우,송지효 vs 송가인,박지영=7:6 ..."}`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn('[Gemini Vision] HTTP error:', response.status, errBody.slice(0, 200));
      if (response.status === 429) {
        throw new Error('QUOTA_EXCEEDED');
      }
      if (response.status === 400 || response.status === 403) {
        throw new Error('API_KEY_INVALID');
      }
      return null;
    }

    const data = await response.json();
    console.log('[Gemini Vision] Response candidates:', data?.candidates?.length);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.warn('[Gemini Vision] No text in response. Full data:', JSON.stringify(data).slice(0, 500));
      return null;
    }
    console.log('[Gemini Vision] Raw response:', text.slice(0, 300));

    const parsed = JSON.parse(text) as ScoreRecognitionResult;
    if (!parsed.matches || !Array.isArray(parsed.matches)) {
      console.warn('[Gemini Vision] Invalid response structure');
      return null;
    }

    // 점수 범위 검증
    parsed.matches = parsed.matches.filter(m =>
      typeof m.matchNumber === 'number' &&
      m.matchNumber >= 1 &&
      m.matchNumber <= matchContext.length
    ).map(m => ({
      ...m,
      team1Score: m.team1Score != null ? Math.min(10, Math.max(0, Math.round(m.team1Score))) : null,
      team2Score: m.team2Score != null ? Math.min(10, Math.max(0, Math.round(m.team2Score))) : null,
    }));

    return parsed;
  } catch (e: any) {
    // QUOTA_EXCEEDED, API_KEY_INVALID는 핸들러에서 처리하도록 re-throw
    if (e?.message === 'QUOTA_EXCEEDED' || e?.message === 'API_KEY_INVALID') {
      throw e;
    }
    if (e?.name === 'AbortError') {
      console.warn('[Gemini Vision] Timeout (30s)');
    } else {
      console.warn('[Gemini Vision] Error:', e);
    }
    return null;
  }
}

// ── 다이어리 AI 분석 ──

import { RadarStats, RadarStatsSnapshot, GearData, DiaryEntry } from '../types';

interface DiaryAIInput {
  stats: RadarStats;
  history: RadarStatsSnapshot[];
  gear: GearData;
  recentEntries: DiaryEntry[];
  playerName?: string;
}

export async function generateDiaryAnalysisAI(
  apiKey: string,
  input: DiaryAIInput,
): Promise<string | null> {
  console.log('[Gemini diary] Calling API...');
  try {
    const { stats, history, gear, recentEntries, playerName } = input;

    // Build stats summary
    const statLines = Object.entries(stats.main)
      .map(([k, v]) => {
        const labels: Record<string, string> = {
          serve: '서브', forehand: '포핸드', backhand: '백핸드',
          volley: '발리', step: '스텝', mental: '멘탈',
        };
        return `${labels[k] || k}: ${v}`;
      }).join(', ');

    const subLines = Object.entries(stats.sub)
      .map(([k, v]) => {
        const labels: Record<string, string> = { slice: '슬라이스', drop: '드롭샷', lob: '로브' };
        return `${labels[k] || k}: ${v}`;
      }).join(', ');

    // Trends
    let trendInfo = '이전 기록 없음';
    if (history.length > 0) {
      const prev = history[history.length - 1];
      const diffs = Object.entries(stats.main).map(([k, v]) => {
        const prevVal = prev.stats.main[k as keyof typeof prev.stats.main] || 50;
        const diff = v - prevVal;
        const labels: Record<string, string> = {
          serve: '서브', forehand: '포핸드', backhand: '백핸드',
          volley: '발리', step: '스텝', mental: '멘탈',
        };
        return `${labels[k] || k}: ${diff > 0 ? '+' : ''}${diff}`;
      });
      trendInfo = `지난달(${prev.month}) 대비: ${diffs.join(', ')}`;
    }

    // Gear info
    const racketInfo = gear.rackets.length > 0
      ? gear.rackets.map(r => `${r.brand} ${r.model}${r.isMain ? '(메인)' : ''}`).join(', ')
      : '미등록';

    const stringInfo = Object.values(gear.strings).map(si => {
      const days = Math.round((Date.now() - new Date(si.replacedAt).getTime()) / (1000 * 60 * 60 * 24));
      return `${si.name} ${si.tension}lb (${days}일/${si.gamesSinceReplace}게임)`;
    }).join(', ') || '미등록';

    // Recent diary entries
    const entryLines = recentEntries.slice(0, 5).map(e => {
      const moodLabels: Record<string, string> = {
        great: '최고', good: '좋음', normal: '보통', bad: '나쁨', terrible: '최악',
      };
      return `[${e.date}] ${moodLabels[e.mood] || e.mood} - ${e.title}: ${e.content.slice(0, 80)}`;
    }).join('\n') || '일지 없음';

    const prompt = `당신은 테니스 전문 AI 코치입니다. ${playerName ? `${playerName} 선수의 ` : ''}다이어리 데이터를 분석하고 맞춤형 조언을 해주세요.

현재 스탯 (0~100):
메인: ${statLines}
서브: ${subLines}

변화 추이:
${trendInfo}

장비:
라켓: ${racketInfo}
스트링: ${stringInfo}

최근 일지:
${entryLines}

다음 형식으로 분석해주세요:

📊 종합 분석
- 현재 강점과 약점 (스탯 기반, 2~3줄)

📈 성장 포인트
- 가장 향상된 부분, 가장 개선이 필요한 부분 (2줄)

🎯 이번 주 훈련 추천
- 약점 보완을 위한 구체적 연습 추천 3가지 (각 1줄)

🏸 장비 코멘트
- 스트링 교체 시기, 장비 상태 한줄평

💪 응원 메시지
- 동기부여 한마디

한국어로 작성, 친근하지만 전문적인 톤으로. 각 섹션은 줄바꿈으로 구분.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Gemini diary] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      console.warn('[Gemini diary] Timeout');
    } else {
      console.warn('[Gemini diary] Error:', e);
    }
    return null;
  }
}
