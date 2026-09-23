# Feature Documentation: Tenant Isolation (Row-Level Security)

## 1. Feature Overview

- **Feature Name:** Tenant Isolation (Row-Level Security)
    
      
    
- **Module:** Supabase Database / Security & Multi-Tenancy Layer
    
      
    
- **Objective:** Enforce strict data segregation at the database level so that organizational teams can only access their own repositories, activity logs, and chat integrations, completely preventing cross-tenant data leaks.
    
      
    

## 2. Technical Mechanism & Architecture

DevAlign achieves multi-tenant isolation through **PostgreSQL Row-Level Security (RLS)** native to Supabase:

  

1. **Authenticated Context:** Every incoming client query passes the authenticated user's JWT session, which provides a verified user ID (`auth.uid()`).
    
      
    
2. **Relational Mapping:** Tables (`repositories`, `activity_logs`, `integrations`) contain a foreign key pointing to `team_id`. Teams are linked to users via a junction table (`team_members`).
    
      
    
3. **RLS Policy Enforcement:** PostgreSQL transparently intercepts all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries, evaluating them against custom security policies that verify whether the requesting user belongs to the target `team_id`.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Client Request:** A Next.js dashboard component queries Supabase (e.g., fetching activity logs for a team).
    
      
    
2. **JWT Passing:** The Supabase client automatically attaches the user's bearer token in the request header.
    
      
    
3. **Database Policy Evaluation:** PostgreSQL evaluates the active RLS policy:
    
      
    - _Does the user's `auth.uid()` exist in the `team_members` table for the target `team_id`?_
        
          
        
4. **Access Grant or Denial:**
    
      
    - If true, the query executes normally and returns filtered rows.
        
          
        
    - If false, the database returns an empty result set or a security violation error, ensuring zero data leakage between teams.
        
          
        

## 4. Implementation Code Pattern (SQL / Supabase RLS Policies)

SQL

```
-- 1. Enable Row-Level Security on tenant-bound tables
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policy for Activity Logs (Team Membership Validation)
CREATE POLICY "Allow team members to view activity logs"
ON activity_logs
FOR SELECT
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);

-- 3. Create RLS Policy for Repositories (Insert & Management for Admins/Members)
CREATE POLICY "Allow team members to manage repositories"
ON repositories
FOR ALL
USING (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  team_id IN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  )
);
```

## 5. Security & Engineering Guardrails

- **Mandatory RLS Activation:** Every newly created table containing tenant-specific data must have RLS explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) before deployment.
    
      
    
- **Bypass Prevention:** Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) bypass RLS and must be restricted exclusively to secure server-side background workers and webhook ingestion gateways—they must never be exposed to frontend client bundles.
    
      
    
- **Relational Verification:** Policies must rely on verified junction queries (`team_members`) rather than relying on unverified user-supplied headers to determine tenant authorization.
  
    [[PRD]]
    
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[tenantrules]]
- [[envsecret]]
- 