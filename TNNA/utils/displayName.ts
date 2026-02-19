import { Player } from '../types';

/**
 * 표시 이름 모드에 따라 이름/별명을 반환하는 헬퍼 생성
 * mode === 'nickname'일 때 별명이 있으면 별명, 없으면 이름
 * mode === 'name' (기본)일 때 항상 이름
 */
// 게스트_ prefix를 G prefix로 변환 (기존 데이터 호환)
function normalizeGuest(name: string): string {
  if (name.startsWith('게스트_')) return `G${name.slice(4)}`;
  return name;
}

export function createDisplayNameFn(
  players: Player[],
  mode?: 'name' | 'nickname',
): (name: string) => string {
  if (!mode || mode === 'name') return (name) => normalizeGuest(name);

  const nicknameMap: Record<string, string> = {};
  for (const p of players) {
    if (p.nickname) nicknameMap[p.name] = p.nickname;
  }
  return (name: string) => nicknameMap[name] || normalizeGuest(name);
}
