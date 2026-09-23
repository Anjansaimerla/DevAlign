# Rules & Engineering Guardrails: Chat Platform Integration

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Chat Platform Integration (Outbound Dispatch Engine)
    
      
    
- **Objective:** Establish strict architectural laws, payload schema mandates, network timeout safeguards, and error-handling rules for dispatching status digests to external communication channels (Discord, Slack).
    
      
    

## 2. Payload Schema & Adaptation Rules

- **Rule 2.1: Strict Platform-Specific Payload Mapping**
    
    Outbound payloads must be strictly mapped to the required JSON wrapper schema of the destination API (e.g., `{ "content": markdownString }` for Discord; `{ "text": markdownString }` for Slack). Sending raw strings or unsupported JSON keys will result in immediate API rejection.
    
      
    
- **Rule 2.2: Character Limit Compliance**
    
    Before dispatching, the outbound dispatcher must verify that the total string length complies with the target platform's payload limits (such as Discord's 2000-character ceiling). Over-length payloads must trigger automated truncation or section chunking.
    
      
    

## 3. Network & Performance Rules

- **Rule 3.1: Mandatory Request Timeouts**
    
    All outbound HTTP requests to third-party chat webhooks must enforce strict request timeouts (e.g., maximum 5000ms). Unbounded HTTP requests are strictly prohibited to prevent worker thread hanging during third-party outages.
    
      
    
- **Rule 3.2: Asynchronous Non-Blocking Dispatch**
    
    Chat webhook dispatches must execute asynchronously in the background. They must never block the primary HTTP request-response cycle or delay the processing queue.
    
      
    

## 4. Error Handling & Resilience Rules

- **Rule 4.1: Rigorous Try/Catch Isolation**
    
    Every outbound HTTP client call must be wrapped in an isolated `try/catch` block. Network failures, DNS resolution errors, or invalid webhook URLs must be caught and logged internally without crashing the background worker process.
    
      
    
- **Rule 4.2: Rate-Limit (429) & Exponential Backoff**
    
    If a chat platform responds with an HTTP `429 Too Many Requests` status code, the dispatcher must handle the rate limit gracefully, respect the `Retry-After` header where available, and implement exponential backoff before attempting delivery retries.
    
      
    
- **Rule 4.3: Inactive Integration Handling**
    
    If an outbound webhook returns an unrecoverable error (such as `404 Not Found` indicating a deleted Discord/Slack webhook), the system must log the failure and flag the integration record in Supabase (`is_active = false`) to prevent spamming dead endpoints.
    
      
    

## 5. Security & Access Control Rules

- **Rule 5.1: Encrypted & RLS-Protected Webhook URLs**
    
    Target chat webhook URLs stored in the Supabase `integrations` table must be protected by Row-Level Security (RLS) policies. Unauthorized users or cross-tenant queries must be strictly barred from reading or hijacking external destination endpoints.
    
      
    
- **Rule 5.2: Secret Exclusions in Logs**
    
    Outbound HTTP request logs, error traces, and console outputs must redact full webhook URLs (masking endpoint tokens) to prevent sensitive communication channel secrets from leaking into plain-text log streams.
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[chatintegration]]
    