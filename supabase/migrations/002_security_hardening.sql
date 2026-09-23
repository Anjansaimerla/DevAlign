-- ============================================================================
-- Migration 002: Security & Integrity Hardening
-- - team_members junction table (tenantrules Rule 3.1 verified auth.uid() mapping)
-- - delivery_id idempotency column + unique constraint (Rule 3.3)
-- - Composite indexes for metrics/aggregation performance (metricsrules §5)
-- - Symmetric USING/WITH CHECK RLS policies (tenantrules Rule 3.2)
-- - INSERT policies for repositories/integrations (missing in 001)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. team_members junction table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    github_username TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (team_id, github_username)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Membership of a team is visible to members of that team only.
-- Uses a SECURITY DEFINER helper to avoid recursive policy evaluation
-- (tenantrules Rule 3.3).
CREATE OR REPLACE FUNCTION is_team_member(check_team_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = check_team_id AND tm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = check_team_id AND t.owner_id = auth.uid()
  );
$$;

CREATE POLICY "Team members can view roster" ON team_members
    FOR SELECT USING (is_team_member(team_id));

CREATE POLICY "Team owners can manage roster" ON team_members
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- 2. Webhook idempotency: delivery_id + unique constraint
-- ---------------------------------------------------------------------------
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS delivery_id TEXT;

-- Partial unique index: only enforce uniqueness for known delivery ids.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_logs_delivery_id
    ON activity_logs (delivery_id)
    WHERE delivery_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Performance indexes (metricsrules §5: composite (team_id, created_at))
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_created
    ON activity_logs (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_team ON repositories (team_id);
CREATE INDEX IF NOT EXISTS idx_integrations_team_active ON integrations (team_id, is_active);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams (owner_id);

-- ---------------------------------------------------------------------------
-- 4. RLS hardening on existing tables
--    Replace owner-only policies from 001 with verified team-membership
--    checks and add missing INSERT/WITH CHECK policies.
-- ---------------------------------------------------------------------------

-- teams ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Teams are viewable by owners" ON teams;
CREATE POLICY "Teams viewable by members or owners" ON teams
    FOR SELECT USING (is_team_member(id));

CREATE POLICY "Team owners can update their teams" ON teams
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams" ON teams
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- repositories ----------------------------------------------------------------
DROP POLICY IF EXISTS "Repositories are viewable by team members" ON repositories;
CREATE POLICY "Repositories readable by team members" ON repositories
    FOR SELECT USING (is_team_member(team_id));

CREATE POLICY "Repositories manageable by team members" ON repositories
    FOR ALL
    USING (is_team_member(team_id))
    WITH CHECK (is_team_member(team_id));

-- activity_logs ----------------------------------------------------------------
DROP POLICY IF EXISTS "Activity logs are viewable by team members" ON activity_logs;
CREATE POLICY "Activity logs readable by team members" ON activity_logs
    FOR SELECT USING (is_team_member(team_id));

-- integrations -------------------------------------------------------------------
DROP POLICY IF EXISTS "Integrations are viewable by team members" ON integrations;
CREATE POLICY "Integrations manageable by team members" ON integrations
    FOR ALL
    USING (is_team_member(team_id))
    WITH CHECK (is_team_member(team_id));
