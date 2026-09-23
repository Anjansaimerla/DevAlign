# Rules & Engineering Guardrails: Asynchronous Event Processing

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Asynchronous Event Processing Engine
    
      
    
- **Objective:** Establish strict architectural rules, performance mandates, and operational guardrails ensuring that background tasks and data processing never block incoming webhook requests or crash the server.
    
      
    

## 2. Request Lifecycle & Performance Rules

- **Rule 2.1: The Absolute Non-Blocking Mandate**
    
    The synchronous request-response cycle of the webhook gateway must _never_ execute heavy data parsing loops, complex database aggregations, or outbound HTTP requests (such as Discord/Slack webhooks). Its sole responsibility is signature validation, immediate response delivery, and asynchronous hand-off.
    
      
    
- **Rule 2.2: Mandatory Sub-200ms Response Window**
    
    The Express webhook endpoint must transmit an HTTP `200 OK` response within **200 milliseconds** of receiving the payload, regardless of network latency or payload size, to satisfy GitHub delivery timeout thresholds.
    
      
    
- **Rule 2.3: Safe Asynchronous Offloading**
    
    Once an incoming payload passes cryptographic verification, its processing must be offloaded immediately to background routines (using mechanisms like `setImmediate`, background workers, or task queues) while the HTTP connection is safely closed.
    
      
    

## 3. Error Isolation & Resilience Rules

- **Rule 3.1: Strict Background Try/Catch Isolation**
    
    All asynchronous background processing functions must be wrapped in rigorous `try/catch` blocks. Because background tasks execute outside the primary HTTP request lifecycle, an unhandled exception or parsing failure must be caught, logged internally, and prevented from crashing the Node.js process.
    
      
    
- **Rule 3.2: Graceful Failure Logging**
    
    If an asynchronous job fails to parse a JSONB payload or write to Supabase, the system must log the failure alongside the event delivery ID (`X-GitHub-Delivery`) into an error log table or console stream for debugging without throwing unhandled promise rejections (`unhandledRejection`).
    
      
    

## 4. Data Integrity & Idempotency Rules

- **Rule 4.1: Immutable Raw Logging First**
    
    Before any background parser attempts to extract metrics, the raw JSON payload must be persisted successfully to the `activity_logs` table. This ensures that even if an asynchronous parser encounters a bug, the raw event data is never permanently lost.
    
      
    
- **Rule 4.2: Idempotent Consumer Design**
    
    Background processing workers must be fully idempotent. If GitHub retries a webhook delivery due to an intermittent network hiccup, processing the same event payload multiple times must update or log the state cleanly without duplicating metrics or corrupting sprint velocity counts.
    
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[asynchronousevent]]
    