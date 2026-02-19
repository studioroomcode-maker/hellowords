-- =============================================
-- TennisApp Supabase 초기 스키마
-- Supabase SQL Editor에서 실행
-- =============================================

-- 1. 프로필 (Supabase Auth 연동)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 클럽
CREATE TABLE clubs (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'Prime',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 클럽 회원 (유저↔클럽↔선수 연결)
CREATE TABLE club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL REFERENCES clubs(code) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  player_name TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  admin_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_code, player_name),
  UNIQUE(club_code, email)
);

-- 4. 선수
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL REFERENCES clubs(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  gender TEXT NOT NULL DEFAULT '남',
  hand TEXT DEFAULT '오른손',
  age_group TEXT DEFAULT '40대',
  racket TEXT DEFAULT '모름',
  player_group TEXT DEFAULT '미배정',
  ntrp REAL,
  admin_ntrp REAL,
  phone TEXT,
  email TEXT,
  mbti TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_code, name)
);

-- 5. 세션 (JSONB - 날짜별 대진+결과 통째 저장)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL REFERENCES clubs(code) ON DELETE CASCADE,
  date TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_code, date)
);

-- 6. 회비 (JSONB)
CREATE TABLE dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL UNIQUE REFERENCES clubs(code) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 가계부
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL REFERENCES clubs(code) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT,
  memo TEXT,
  billing_period_id TEXT,
  player_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 가계부 커스텀 카테고리
CREATE TABLE ledger_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL REFERENCES clubs(code) ON DELETE CASCADE,
  label TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  UNIQUE(club_code, label, entry_type)
);

-- 9. 예약 (JSONB)
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code TEXT NOT NULL UNIQUE REFERENCES clubs(code) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 글로벌 설정
CREATE TABLE global_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_sessions_club_date ON sessions(club_code, date);
CREATE INDEX idx_players_club ON players(club_code);
CREATE INDEX idx_club_members_club ON club_members(club_code);
CREATE INDEX idx_club_members_user ON club_members(user_id);
CREATE INDEX idx_ledger_club_date ON ledger_entries(club_code, date);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_categories ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수: 클럽 회원 여부
CREATE OR REPLACE FUNCTION is_club_member(code TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM club_members WHERE club_code = code AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 헬퍼 함수: 클럽 관리자 여부
CREATE OR REPLACE FUNCTION is_club_admin(code TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM club_members WHERE club_code = code AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 헬퍼 함수: 슈퍼 관리자 여부
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT is_super_admin FROM profiles WHERE id = auth.uid()), FALSE);
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles: 자기 프로필만 접근
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);

-- clubs
CREATE POLICY "clubs_read" ON clubs FOR SELECT USING (is_club_member(code) OR is_super_admin());
CREATE POLICY "clubs_insert" ON clubs FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clubs_update" ON clubs FOR UPDATE USING (is_club_admin(code) OR is_super_admin());
CREATE POLICY "clubs_delete" ON clubs FOR DELETE USING (is_super_admin());

-- players
CREATE POLICY "players_read" ON players FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "players_update" ON players FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "players_delete" ON players FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- sessions
CREATE POLICY "sessions_read" ON sessions FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "sessions_update" ON sessions FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "sessions_delete" ON sessions FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- club_members
CREATE POLICY "members_read" ON club_members FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "members_insert" ON club_members FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "members_update" ON club_members FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "members_delete" ON club_members FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- dues
CREATE POLICY "dues_read" ON dues FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "dues_insert" ON dues FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "dues_update" ON dues FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "dues_delete" ON dues FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- ledger_entries
CREATE POLICY "ledger_read" ON ledger_entries FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "ledger_insert" ON ledger_entries FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "ledger_update" ON ledger_entries FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "ledger_delete" ON ledger_entries FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- reservations
CREATE POLICY "reservations_read" ON reservations FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "reservations_insert" ON reservations FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "reservations_update" ON reservations FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "reservations_delete" ON reservations FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- ledger_categories
CREATE POLICY "ledger_cat_read" ON ledger_categories FOR SELECT USING (is_club_member(club_code) OR is_super_admin());
CREATE POLICY "ledger_cat_insert" ON ledger_categories FOR INSERT WITH CHECK (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "ledger_cat_update" ON ledger_categories FOR UPDATE USING (is_club_admin(club_code) OR is_super_admin());
CREATE POLICY "ledger_cat_delete" ON ledger_categories FOR DELETE USING (is_club_admin(club_code) OR is_super_admin());

-- global_config (슈퍼어드민 전용)
CREATE POLICY "global_read" ON global_config FOR SELECT USING (is_super_admin());
CREATE POLICY "global_insert" ON global_config FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "global_update" ON global_config FOR UPDATE USING (is_super_admin());
CREATE POLICY "global_delete" ON global_config FOR DELETE USING (is_super_admin());

-- =============================================
-- Auth Trigger: 회원가입 시 profiles 자동 생성
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- Storage: 프로필 이미지 버킷
-- Supabase 대시보드 > Storage에서 'avatars' 버킷 생성 (Public)
-- 또는 아래 SQL 실행:
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatar_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatar_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- =============================================
-- 기본 데이터: 슈퍼어드민 이메일 (앱에서 가입 후 수동 설정)
-- UPDATE profiles SET is_super_admin = TRUE WHERE email = 'studioroomcode@gmail.com';
-- =============================================
