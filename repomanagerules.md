# Rules & Engineering Guardrails: Repository Management

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Repository Management
    
      
    
- **Objective:** Establish strict database constraints, access control rules, input validation standards, and lifecycle management guidelines for linking and managing GitHub repositories within team workspaces.
    
      
    

## 2. Database & Schema Rules

- **Rule 2.1: Unique GitHub Repository Identifier Constraint**
    
    The `github_repo_id` column in the `repositories` table must enforce a unique constraint at the database level. A single GitHub repository cannot be linked multiple times across conflicting teams or workspaces.
    
      
    
- **Rule 2.2: Mandatory Foreign Key Cascades**
    
    All repository records must be bound to a valid `team_id` with strict `ON DELETE CASCADE` referential integrity enabled. Deleting a team workspace must automatically purge all associated repository bindings without leaving orphaned rows.
    
      
    
- **Rule 2.3: Immutable Repository Ownership Scope**
    
    Every repository entry must maintain a direct, verifiable link to its parent team. Querying or modifying repository records outside an active team session is strictly prohibited.
    
      
    

## 3. Authorization & Access Control Rules

- **Rule 3.1: Row-Level Security (RLS) Enforcement**
    
    Client-side and frontend operations interacting with the `repositories` table must be governed entirely by Supabase RLS policies. Users can only insert, read, or delete repository records belonging to their authorized `team_id`.
    
      
    
- **Rule 3.2: Administrative Role Verification**
    
    Only authenticated users holding administrative or owner roles within a team workspace are permitted to link new GitHub repositories or disconnect existing ones.
    
      
    

## 4. Input Validation & Data Integrity Rules

- **Rule 4.1: Strict `owner/repo` String Format Validation**
    
    Repository name inputs submitted from the frontend must be validated against standard GitHub naming conventions (`owner/repo`) prior to database insertion to prevent malformed path strings.
    
      
    
- **Rule 4.2: Type Safety for GitHub Repository IDs**
    
    The `github_repo_id` field must be strictly handled and stored as a 64-bit integer (`BIGINT`), preventing precision loss during payload mapping and database persistence.
    
      
    

## 5. Lifecycle & Disconnection Rules

- **Rule 5.1: Graceful Unlinking Handling**
    
    When a team disconnects a repository via the dashboard, the system must clean up associated webhook configurations or log a clear warning if manual revocation on GitHub is required.
    
      
    
- **Rule 5.2: Safe Handling of Deleted Repositories**
    
    If a linked repository is deleted or made private on GitHub, subsequent webhook ingestion failures must be caught gracefully without causing unhandled exceptions in the backend processing pipeline.
    
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[repomanage]]
    