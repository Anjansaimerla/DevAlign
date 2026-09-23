-- Create Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Repositories Table
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    repo_name TEXT NOT NULL, -- e.g., 'owner/repo'
    github_repo_id BIGINT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Activity Logs Table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'push', 'pull_request', 'issue'
    actor_github_username TEXT NOT NULL,
    payload_summary JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Integrations Table
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'discord', 'slack'
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access data belonging to their team
-- Note: This assumes a mapping between auth.users and teams exists.
-- In a real implementation, we might have a 'team_members' table.
-- For the MVP, we'll assume the owner_id in teams is sufficient for the lead.

CREATE POLICY "Teams are viewable by owners" ON teams
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Repositories are viewable by team members" ON repositories
    FOR SELECT USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

CREATE POLICY "Activity logs are viewable by team members" ON activity_logs
    FOR SELECT USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );

CREATE POLICY "Integrations are viewable by team members" ON integrations
    FOR SELECT USING (
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    );
