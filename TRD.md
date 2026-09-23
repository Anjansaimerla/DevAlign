# Technical Requirements Document (TRD): DevAlign

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Document Version:** 1.0
    
      
    
- **Objective:** Define the system architecture, component specifications, data flow pipelines, security protocols, and deployment infrastructure required to build and scale the DevAlign platform.
    
      
    

## 2. System Architecture Overview

DevAlign follows a decoupled client-server architecture communicating over HTTPS and RESTful APIs, utilizing asynchronous webhook listeners for event-driven data ingestion.

  

```
[ GitHub Webhooks ] ──(HTTPS POST)──> [ Node.js / Express API (Render) ]
                                            │
                                    (Async Processing)
                                            │
                                            ▼
[ Next.js Dashboard (Vercel) ] <──(REST API)──> [ Supabase (PostgreSQL + Auth) ]
                                            │
                                     (Webhook Dispatch)
                                            │
                                            ▼
                               [ Discord / Slack Channels ]
```

## 3. Technology Stack Specifications

|**Layer**|**Technology**|**Purpose**|**Hosting / Environment**|
|---|---|---|---|
|**Frontend Dashboard**|Next.js (React) + Tailwind CSS|Lead control center for viewing team metrics and managing integrations.|Vercel|
|**Backend API / Engine**|Node.js with Express|Webhook receiver, signature verification, data parser, and cron dispatch engine.|Render|
|**Database & Auth**|Supabase (PostgreSQL + Auth)|Relational storage for users, teams, repos, logs, and GitHub OAuth sessions.|Supabase Cloud|
|**Integrations**|GitHub REST/Webhooks, Discord/Slack Webhooks|Real-time event ingestion and automated Markdown notification delivery.|Third-Party APIs|

## 4. Data Models & Database Schema (Supabase PostgreSQL)

### 4.1 Table: `teams`

- `id` UUID (Primary Key, Default: `gen_random_uuid()`)
    
      
    
- `name` TEXT (Not Null)
    
      
    
- `owner_id` UUID (References `auth.users.id`, Not Null)
    
      
    
- `created_at` TIMESTAMPTZ (Default: `NOW()`)
    
      
    

### 4.2 Table: `repositories`

- `id` UUID (Primary Key, Default: `gen_random_uuid()`)
    
      
    
- `team_id` UUID (References `teams.id` on delete cascade, Not Null)
    
      
    
- `repo_name` TEXT (Not Null, e.g., `owner/repo`)
    
      
    
- `github_repo_id` BIGINT (Unique, Not Null)
    
      
    
- `created_at` TIMESTAMPTZ (Default: `NOW()`)
    
      
    

### 4.3 Table: `activity_logs`

- `id` UUID (Primary Key, Default: `gen_random_uuid()`)
    
      
    
- `team_id` UUID (References `teams.id` on delete cascade, Not Null)
    
      
    
- `event_type` TEXT (Not Null, e.g., `push`, `pull_request`, `issue`)
    
      
    
- `actor_github_username` TEXT (Not Null)
    
      
    
- `payload_summary` JSONB (Not Null, stores commit counts, message snippets, PR titles)
    
      
    
- `created_at` TIMESTAMPTZ (Default: `NOW()`)
    
      
    

### 4.4 Table: `integrations`

- `id` UUID (Primary Key, Default: `gen_random_uuid()`)
    
      
    
- `team_id` UUID (References `teams.id` on delete cascade, Not Null)
    
      
    
- `platform` TEXT (Not Null, e.g., `discord`, `slack`)
    
      
    
- `webhook_url` TEXT (Not Null)
    
      
    
- `is_active` BOOLEAN (Default: `TRUE`)
    
      
    
- `created_at` TIMESTAMPTZ (Default: `NOW()`)
    
      
    

## 5. API Endpoints & Request/Response Contracts

### 5.1 Ingest GitHub Webhooks

- **Endpoint:** `POST /api/webhooks/github`
    
      
    
- **Headers:**
    
      
    - `X-GitHub-Event`: Event type (`push`, `pull_request`, etc.)
        
          
        
    - `X-Hub-Signature-256`: HMAC SHA-256 cryptographic signature
        
          
        
- **Behavior:** Validates signature $\rightarrow$ Responds with `200 OK` in $<200\text{ms}$ $\rightarrow$Asynchronously inserts event data into `activity_logs`.
    
      
    
- **Response:** `200 OK` `{ "status": "received" }`
    
      
    

### 5.2 Fetch Team Activity & Velocity (Frontend API)

- **Endpoint:** `GET /api/teams/:teamId/metrics`
    
      
    
- **Headers:** `Authorization: Bearer <Supabase-Access-Token>`
    
      
    
- **Response:** `200 OK`
    
      
    
    JSON
    
    ```
    {
      "team_id": "uuid",
      "total_commits_24h": 14,
      "active_prs": 3,
      "inactive_members": ["user1"]
    }
    ```
    

## 6. Security & Performance Protocols

- **Webhook Signature Verification:**
    
    The Express backend must compute an HMAC hex digest using the GitHub Webhook Secret and compare it securely against the incoming `X-Hub-Signature-256` header using `crypto.timingSafeEqual` to prevent timing attacks.
    
      
    
- **Environment Isolation:**
    
    All sensitive credentials (Supabase Service Role Keys, GitHub Client Secrets, Webhook Secrets) must be strictly loaded via environment variables (`process.env`) and excluded from source control.
    
      
    
- **Database Row-Level Security (RLS):**
    
    Supabase RLS policies must be enforced on all tables so authenticated users can only query data belonging to their respective `team_id`.
    
    [[systemarchitecture]]
    [[rules]]
    