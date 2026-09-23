# Rules & Engineering Guardrails: Tenant Isolation (Row-Level Security)

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Tenant Isolation (PostgreSQL Row-Level Security)
    
      
    
- **Objective:** Establish strict database-level security mandates, RLS policy standards, service role restrictions, and multi-tenancy verification rules to completely eliminate cross-tenant data leaks.
    
      
    

## 2. Core Isolation & RLS Enforcement Rules

- **Rule 2.1: Mandatory RLS Activation Mandate**
    
    Every newly created database table containing tenant-bound data (`repositories`, `activity_logs`, `integrations`, `team_members`) must have Row-Level Security explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) prior to deployment. Unprotected tables are strictly prohibited.
    
      
    
- **Rule 2.2: Zero Trust Default State**
    
    Enabling RLS without explicit security policies defaults to denying all access. Developers must explicitly define granular `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies for every table.
    
      
    
- **Rule 2.3: Explicit `team_id` Relational Binding**
    
    Every tenant-specific table must include a foreign key column pointing to `team_id`, ensuring that all queries can be deterministically scoped and filtered by organizational workspace.
    
      
    

## 3. Policy Design & Junction Verification Rules

- **Rule 3.1: Verified `auth.uid()` Mapping**
    
    All RLS security policies must evaluate user permissions by checking whether the authenticated session's unique identifier (`auth.uid()`) exists in the `team_members` junction table for the target `team_id`. Relying on unverified client-supplied claims is strictly forbidden.
    
      
    
- **Rule 3.2: Symmetric `USING` and `WITH CHECK` Clauses**
    
    For data modification operations (`INSERT`, `UPDATE`), RLS policies must define both `USING` (for existing rows) and `WITH CHECK` (for newly inserted/updated row data) clauses to prevent privilege escalation or data insertion into unauthorized teams.
    
      
    
- **Rule 3.3: Prevention of Infinite Recursion in Policies**
    
    When writing policies on junction tables like `team_members`, developers must structure queries carefully (or use security definer functions where appropriate) to prevent recursive policy evaluation errors.
    
      
    

## 4. Service Role & Privileged Access Rules

- **Rule 4.1: Strict Service Role Key Isolation**
    
    The Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS policies. It must be restricted exclusively to secure server-side background workers, cron jobs, and webhook ingestion gateways—it must never be exposed to frontend client bundles or Next.js public environment variables (`NEXT_PUBLIC_...`).
    
      
    
- **Rule 4.2: Frontend Anon Key Limitation**
    
    Client-side applications must interact with Supabase exclusively using the public anonymous key (`SUPABASE_ANON_KEY`), ensuring all queries are fully subject to RLS enforcement.
    
      
    

## 5. Security Audit & Testing Rules

- **Rule 5.1: Cross-Tenant Leak Testing**
    
    Before releasing new database schemas or queries, automated tests must verify that a user belonging to Team A cannot read, update, or delete records belonging to Team B.
    
      
    
- **Rule 5.2: Query Plan Inspection for Policy Overhead**
    
    Developers must periodically review PostgreSQL query execution plans (`EXPLAIN ANALYZE`) on tenant-bound tables to ensure that RLS subqueries leverage proper foreign key indexes and do not introduce unindexed table scans.
    
    [[PRD]]
    
    [[TRD]]
    [[rules]]
    [[tenant]]
    