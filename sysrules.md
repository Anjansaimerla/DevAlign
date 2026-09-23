# Rules & Architecture Guidelines: DevAlign System Design

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Document Version:** 1.0
    
      
    
- **Objective:** Establish the mandatory technical laws, architectural boundaries, and coding rules that govern the engineering and implementation of the DevAlign system.
    
      
    

## 2. Ingestion & API Guardrails (The Gateway Rules)

- **Rule 2.1: The Zero-Blocking Response Rule**
    
    The GitHub webhook endpoint (`POST /api/webhooks/github`) must **never** execute database writes, payload parsing loops, or outbound HTTP requests within the synchronous request-response cycle. It must authenticate, return an immediate `200 OK` (within under 200ms), and delegate all processing to asynchronous background routines.
    
      
    
- **Rule 2.2: Mandatory HMAC Signature Verification**
    
    Every incoming webhook request must be validated using cryptographic signature verification (`X-Hub-Signature-256` checked via `crypto.timingSafeEqual`). Any payload failing verification must be rejected instantly with a `401 Unauthorized` status.
    
      
    
- **Rule 2.3: Idempotent Event Handling**
    
    Because webhook delivery systems (like GitHub) can occasionally retry requests due to network timeouts, all event ingestion pipelines must be designed to be idempotent (safe to process duplicate events without corrupting aggregate counts).
    
      
    

## 3. Data & Storage Rules (Supabase & PostgreSQL)

- **Rule 3.1: Strict Row-Level Security (RLS)**
    
    No client-side or frontend query may bypass Supabase RLS policies. Every table (`teams`, `repositories`, `activity_logs`, `integrations`) must have explicit policies ensuring a user can only read, write, or update records tied to their authorized `team_id`.
    
      
    
- **Rule 3.2: JSONB Payload Isolation**
    
    Raw incoming webhook payloads must be stored as immutable `JSONB` data inside `activity_logs`. Never alter raw event payloads directly; instead, parse and extract metrics downstream via read-only transformation scripts.
    
      
    
- **Rule 3.3: Cascading Deletes & Referential Integrity**
    
    Foreign key relationships must be strictly defined with `ON DELETE CASCADE` rules so that deleting a team or repository cleanly purges orphaned activity logs and integration webhooks without leaving dangling references.
    
      
    

## 4. Backend & Processing Rules (Node.js / Express)

- **Rule 4.1: Defensive Try/Catch Isolation**
    
    All external API calls (Notion, GitHub REST, Discord/Slack webhooks) must be wrapped in isolated `try/catch` blocks. A failure or timeout in an external third-party API must log the error gracefully without crashing the Node.js server process.
    
      
    
- **Rule 4.2: Strict Environment Variable Dependency**
    
    Hardcoding secrets, API keys, database URLs, or webhook signing secrets into the codebase is strictly forbidden. All configurations must be loaded exclusively through validated environment variables (`process.env`).
    
      
    
- **Rule 4.3: Stateless Worker Design**
    
    Background aggregation jobs and cron workers must remain entirely stateless. They must fetch state dynamically from Supabase, process the data, dispatch the notifications, and terminate without relying on local server disk storage.
    
      
    

## 5. Security & Deployment Guardrails

- **Rule 5.1: HTTPS-Only Enforcement**
    
    All webhooks, frontend dashboard traffic, and backend REST communications must be transmitted over encrypted TLS/HTTPS connections. HTTP requests must be automatically redirected or rejected.
    
      
    
- **Rule 5.2: Secret Rotation Readiness**
    
    Webhook signing secrets and OAuth client credentials must be structured so they can be rotated via environment variables without requiring structural database migrations or application redeployments.
    
    [[PRD]]
    [[TRD]]
    [[systemarchitecture]]
    [[rules]]
    