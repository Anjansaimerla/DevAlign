# Rules & Engineering Guardrails: Automated GitHub Webhook Ingestion

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Automated GitHub Webhook Ingestion (`POST /api/webhooks/github`)
    
      
    
- **Objective:** Establish rigid technical constraints, security protocols, and operational laws governing the ingestion of real-time developer activity payloads from GitHub.
    
      
    

## 2. Security & Authentication Guardrails

- **Rule 2.1: Absolute Mandatory Signature Verification**
    
    Every incoming webhook request must contain a valid `X-Hub-Signature-256` header. Requests missing this header or carrying an invalid signature must be rejected instantly with a `401 Unauthorized` response before touching any database or business logic.
    
      
    
- **Rule 2.2: Constant-Time Comparison Requirement**
    
    When validating the HMAC SHA-256 digest, the server must use `crypto.timingSafeEqual` rather than standard equality operators (`===`). This prevents timing-based side-channel attacks designed to expose the webhook secret.
    
      
    
- **Rule 2.3: Environment-Bound Secret Isolation**
    
    The webhook signing secret (`GITHUB_WEBHOOK_SECRET`) must never be hardcoded into source files or configuration objects. It must be injected exclusively at runtime via environment variables (`process.env.GITHUB_WEBHOOK_SECRET`).
    
      
    

## 3. Performance & Architecture Guardrails

- **Rule 3.1: The 200ms Response Window (Zero-Blocking)**
    
    The endpoint must reply with an HTTP `200 OK` status code within **200 milliseconds** of receipt. Heavy database transformations, data parsing loops, and outbound API calls (such as Slack/Discord pings) are strictly forbidden within this synchronous request cycle.
    
      
    
- **Rule 3.2: Asynchronous Offloading**
    
    Once a payload's signature is verified, the server's sole immediate action is to insert the raw payload into the Supabase `activity_logs` table (or push it to an async queue). All parsing and aggregation must happen downstream via background workers or cron routines.
    
      
    
- **Rule 3.3: Idempotent Delivery Handling**
    
    Because GitHub automatically retries webhook deliveries if a network timeout occurs, the ingestion logic must be idempotent. Duplicate delivery attempts (tracked via `X-GitHub-Delivery` or unique commit hash constraints) must not result in duplicate analytics corruption.
    
      
    

## 4. Data & Persistence Guardrails

- **Rule 4.1: Immutable JSONB Ingestion**
    
    Raw incoming payloads must be stored directly as immutable `JSONB` data types inside the `activity_logs`table. Modifying or mutating raw payload structures directly during ingestion is strictly prohibited; transformations must occur downstream on read-only queries.
    
      
    
- **Rule 4.2: Graceful Error Isolation**
    
    If database insertion fails due to a transient connection drop or syntax anomaly, the Express server must catch the error in a strict `try/catch` block, log the failure internally for debugging, and return a clean error response without crashing the Node.js process.
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[gitwebhookingest]]
    