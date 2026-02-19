-- =============================================
-- RLS 정책 수정: 403 Forbidden 에러 해결
-- 모든 기존 정책 삭제 후 재생성
-- =============================================

-- ── 기존 + 신규 정책 이름 모두 삭제 (중복 방지) ──

-- profiles
DROP POLICY IF EXISTS "profiles_self" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- clubs
DROP POLICY IF EXISTS "clubs_read" ON clubs;
DROP POLICY IF EXISTS "clubs_write" ON clubs;
DROP POLICY IF EXISTS "clubs_select" ON clubs;
DROP POLICY IF EXISTS "clubs_insert" ON clubs;
DROP POLICY IF EXISTS "clubs_update" ON clubs;

-- club_members
DROP POLICY IF EXISTS "members_read" ON club_members;
DROP POLICY IF EXISTS "members_write" ON club_members;
DROP POLICY IF EXISTS "members_select" ON club_members;
DROP POLICY IF EXISTS "members_insert" ON club_members;
DROP POLICY IF EXISTS "members_update" ON club_members;
DROP POLICY IF EXISTS "members_delete" ON club_members;

-- players
DROP POLICY IF EXISTS "players_read" ON players;
DROP POLICY IF EXISTS "players_write" ON players;
DROP POLICY IF EXISTS "players_select" ON players;
DROP POLICY IF EXISTS "players_insert" ON players;
DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "players_delete" ON players;

-- sessions
DROP POLICY IF EXISTS "sessions_read" ON sessions;
DROP POLICY IF EXISTS "sessions_write" ON sessions;
DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

-- dues
DROP POLICY IF EXISTS "dues_read" ON dues;
DROP POLICY IF EXISTS "dues_write" ON dues;
DROP POLICY IF EXISTS "dues_select" ON dues;
DROP POLICY IF EXISTS "dues_insert" ON dues;
DROP POLICY IF EXISTS "dues_update" ON dues;
DROP POLICY IF EXISTS "dues_delete" ON dues;

-- ledger_entries
DROP POLICY IF EXISTS "ledger_read" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_write" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_select" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_insert" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_update" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_delete" ON ledger_entries;

-- ledger_categories
DROP POLICY IF EXISTS "ledger_cat_read" ON ledger_categories;
DROP POLICY IF EXISTS "ledger_cat_write" ON ledger_categories;
DROP POLICY IF EXISTS "ledger_cat_select" ON ledger_categories;
DROP POLICY IF EXISTS "ledger_cat_insert" ON ledger_categories;
DROP POLICY IF EXISTS "ledger_cat_update" ON ledger_categories;
DROP POLICY IF EXISTS "ledger_cat_delete" ON ledger_categories;

-- reservations
DROP POLICY IF EXISTS "reservations_read" ON reservations;
DROP POLICY IF EXISTS "reservations_write" ON reservations;
DROP POLICY IF EXISTS "reservations_select" ON reservations;
DROP POLICY IF EXISTS "reservations_insert" ON reservations;
DROP POLICY IF EXISTS "reservations_update" ON reservations;
DROP POLICY IF EXISTS "reservations_delete" ON reservations;

-- global_config
DROP POLICY IF EXISTS "global_read" ON global_config;
DROP POLICY IF EXISTS "global_write" ON global_config;
DROP POLICY IF EXISTS "global_select" ON global_config;

-- ── 새 정책 생성 ──

-- profiles: 자기 것만
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- clubs: 인증된 사용자 모두 허용
CREATE POLICY "clubs_select" ON clubs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "clubs_insert" ON clubs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clubs_update" ON clubs FOR UPDATE USING (auth.role() = 'authenticated');

-- club_members: 인증된 사용자 모두 허용
CREATE POLICY "members_select" ON club_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "members_insert" ON club_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "members_update" ON club_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "members_delete" ON club_members FOR DELETE USING (auth.role() = 'authenticated');

-- players: 인증된 사용자 모두 허용
CREATE POLICY "players_select" ON players FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "players_update" ON players FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "players_delete" ON players FOR DELETE USING (auth.role() = 'authenticated');

-- sessions: 인증된 사용자 모두 허용
CREATE POLICY "sessions_select" ON sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "sessions_update" ON sessions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "sessions_delete" ON sessions FOR DELETE USING (auth.role() = 'authenticated');

-- dues: 인증된 사용자 모두 허용
CREATE POLICY "dues_select" ON dues FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "dues_insert" ON dues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "dues_update" ON dues FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "dues_delete" ON dues FOR DELETE USING (auth.role() = 'authenticated');

-- ledger_entries: 인증된 사용자 모두 허용
CREATE POLICY "ledger_select" ON ledger_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ledger_insert" ON ledger_entries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ledger_update" ON ledger_entries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ledger_delete" ON ledger_entries FOR DELETE USING (auth.role() = 'authenticated');

-- ledger_categories: 인증된 사용자 모두 허용
CREATE POLICY "ledger_cat_select" ON ledger_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ledger_cat_insert" ON ledger_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ledger_cat_update" ON ledger_categories FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ledger_cat_delete" ON ledger_categories FOR DELETE USING (auth.role() = 'authenticated');

-- reservations: 인증된 사용자 모두 허용
CREATE POLICY "reservations_select" ON reservations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reservations_insert" ON reservations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "reservations_update" ON reservations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "reservations_delete" ON reservations FOR DELETE USING (auth.role() = 'authenticated');

-- global_config: super admin만
CREATE POLICY "global_select" ON global_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "global_write" ON global_config FOR ALL USING (
  COALESCE((SELECT is_super_admin FROM profiles WHERE id = auth.uid()), FALSE)
);
