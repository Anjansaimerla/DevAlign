# System Architecture Document (SAD): DevAlign

## 1. Executive Summary & Architecture Goals

**DevAlign** is an event-driven, micro-services-adjacent automation platform designed to ingest developer activity (GitHub), process and aggregate metadata, and dispatch automated status digests to chat workspaces (Discord/Slack).

  

The architecture is built around three core engineering tenets:

  

1. **Zero-Blocking Ingestion:** Webhook endpoints must never block or timeout under burst load.
    
      
    
2. **Stateless Scalability:** Backend processing components must remain stateless, delegating persistence and state management entirely to managed relational storage (Supabase PostgreSQL).
    
      
    
3. **Strict Separation of Concerns:** Clear isolation between the event ingestion layer, the processing/cron execution layer, the persistence layer, and the dashboard frontend.
    
      
    

## 2. High-Level Architectural Diagram

```
                                    +-----------------------+
                                    |     GitHub Repos      |
                                    +-----------------------+
                                                 |
                                         (HTTPS Webhooks)
                                                 v
+------------------------+          +-----------------------+          +------------------------+
| Next.js Frontend App   | <------> | Node.js Express API   | <------> | Supabase Cloud         |
| (Vercel Edge/Serverless|  (REST)  | (Render Web Service)  |  (SQL)   | (PostgreSQL + Auth)    |
+------------------------+          +-----------------------+          +------------------------+
                                                 |
                                       (Outbound Webhook Push)
                                                 v
                                    +-----------------------+
                                    | Discord / Slack / WA  |
                                    +-----------------------+
```

## 3. Detailed Component Architecture

### 3.1 Ingestion Layer (The Webhook Gateway)

- **Technology:** Node.js running an Express server deployed on Render.
    
      
    
- **Responsibility:** Acts as the public-facing entry point for all incoming GitHub webhook payloads (`push`, `pull_request`, `issues`).
    
      
    
- **Execution Flow:**
    
      
    1. **TLS Termination:** Encrypted via HTTPS.
        
          
        
    2. **Signature Verification Middleware:** Extracts the `X-Hub-Signature-256` header, calculates an HMAC SHA-256 hash using the shared webhook secret, and executes a constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
        
          
        
    3. **Immediate Acknowledgment:** Returns an HTTP `200 OK` response with `{ status: "received" }` in under 100ms to comply with GitHub's timeout policies.
        
          
        
    4. **Asynchronous Hand-off:** Pushes the raw payload payload into the database for background processing.
        
          
        

### 3.2 Persistence & State Layer (Supabase PostgreSQL)

- **Technology:** Managed Supabase PostgreSQL instance featuring Row-Level Security (RLS) and built-in connection pooling.
    
      
    
- **Responsibility:** Relational database storage managing user identity sessions, organizational scopes, repository bindings, and raw activity logs.
    
      
    
- **Schema Topology:**
    
      
    - `teams`: Manages organizational grouping and ownership.
        
          
        
    - `repositories`: Maps target GitHub repositories (`owner/repo`) to specific `team_id` keys.
        
          
        
    - `activity_logs`: Ingests high-frequency raw JSONB webhook event payloads for asynchronous extraction.
        
          
        
    - `integrations`: Secures outbound chat webhook endpoints (`discord`/`slack`) per team.
        
          
        

### 3.3 Processing & Aggregation Engine (The Cron Worker)

- **Technology:** Node-cron / Scheduled background worker routine inside the Node.js backend.
    
      
    
- **Responsibility:** Periodically (e.g., daily at 18:00 UTC) aggregates raw logs into human-readable digests.
    
      
    
- **Execution Flow:**
    
      
    1. Queries all active teams from Supabase.
        
          
        
    2. Fetches `activity_logs` entries created within the past 24 hours for each team.
        
          
        
    3. Parses JSONB payloads to sort items into structured groups: _Completed Tasks_ (merged PRs, closed issues), _Active Work_ (open branches/PRs), and _Inactive Members_ (zero commits logged over a 72-hour window).
        
          
        
    4. Compiles metrics into a structured Markdown text template.
        
          
        

### 3.4 Delivery Layer (Notification Dispatcher)

- **Technology:** Outbound HTTP client (`axios`/`fetch`).
    
      
    
- **Responsibility:** Pushes formatted Markdown digests directly to client-configured chat communication endpoints.
    
      
    
- **Execution Flow:**
    
      
    1. Retrieves the target `webhook_url` from the `integrations` table for the matching team.
        
          
        
    2. Sends an HTTP `POST` request payload matching the target platform's required formatting schema (e.g., Discord/Slack webhook JSON structure).
        
          
        
    3. Handles exponential backoff retries if network errors or rate limits occur.
        
          
        

### 3.5 Presentation Layer (Lead Control Dashboard)

- **Technology:** Next.js (React) + Tailwind CSS deployed on Vercel.
    
      
    
- **Responsibility:** Provides team leads and institutional managers with a responsive user interface.
    
      
    
- **Execution Flow:**
    
      
    - Authenticates users via Supabase Auth (GitHub OAuth).
        
          
        
    - Executes secure REST queries against Supabase tables protected by RLS policies to render team velocity charts, active repository statuses, and blocker flags.
        
          
        

## 4. Data Flow Lifecycle (End-to-End Sequence)

1. **Trigger:** A developer pushes a commit to a repository configured with the DevAlign webhook.
    
      
    
2. **Ingest:** GitHub sends an HTTP POST to `[https://api.devalign.com/api/webhooks/github](https://api.devalign.com/api/webhooks/github)`.
    
      
    
3. **Validate & Acknowledge:** The Express gateway validates the HMAC signature, responds with `200 OK`, and saves the raw payload into Supabase `activity_logs`.
    
      
    
4. **Aggregate:** The scheduled backend background worker queries the logs, summarizes developer output, and flags blockers.
    
      
    
5. **Dispatch:** The backend formats the digest into Markdown and executes an HTTP POST to the team's Discord or Slack webhook channel.
    
      
    
6. **Visualize:** The project lead opens the Next.js dashboard to view consolidated sprint metrics and team velocity in real time.
    
      
    

## 5. Security Architecture & Threat Mitigation

- **Cryptographic Validation:** Unverified or forged webhooks are rejected at the edge gateway before touching database memory.
    
      
    
- **Least Privilege Access:** Database connections utilize restricted service roles or authenticated RLS scopes, ensuring a compromised team token cannot read cross-tenant data.
    
      
    
- **Credential Isolation:** All application secrets (Supabase keys, GitHub client secrets, webhook signing keys) are injected exclusively through runtime environment variables (`process.env`) and omitted from source code repositories.
  [[PRD]]
- [[TRD]]
- [[sysrules]]
- [[rules]]
- 