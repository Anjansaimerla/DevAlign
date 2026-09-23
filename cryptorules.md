# Rules & Engineering Guardrails: Cryptographic Webhook Security

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Cryptographic Webhook Security (HMAC Validation Middleware)
    
      
    
- **Objective:** Establish strict security mandates, cryptographic laws, and operational rules governing the validation and verification of incoming webhook payloads from GitHub.
    
      
    

## 2. Header Enforcement Rules

- **Rule 2.1: Mandatory Signature Header Presence**
    
    Every incoming webhook request hitting the API gateway must include the `X-Hub-Signature-256`header. Requests lacking this header are automatically classified as unauthorized and must be intercepted and rejected immediately.
    
      
    
- **Rule 2.2: Pre-Processing Verification**
    
    Cryptographic signature verification must execute as the absolute first middleware step in the request lifecycle. No data parsing, routing logic, or database query may occur before the signature is verified.
    
      
    

## 3. Cryptographic Execution Rules

- **Rule 3.1: Strict Constant-Time Comparison Mandate**
    
    Standard JavaScript equality operators (`===` or `==`) are strictly prohibited for signature validation because they leak timing information. Developers must use `crypto.timingSafeEqual` with properly sized Buffer objects to ensure constant-time evaluation and prevent timing attacks.
    
      
    
- **Rule 3.2: Raw Payload Body Integrity**
    
    The cryptographic hash must be computed directly against the raw request body payload bytes or string representation. Re-serializing parsed JSON objects to calculate the digest can introduce whitespace or key-ordering discrepancies that cause valid signatures to fail.
    
      
    

## 4. Secret Management Rules

- **Rule 4.1: Runtime Environment Isolation**
    
    The webhook signing secret (`GITHUB_WEBHOOK_SECRET`) must be loaded exclusively at runtime via environment variables (`process.env.GITHUB_WEBHOOK_SECRET`). Hardcoding or committing secrets into source control files is a critical security violation.
    
      
    
- **Rule 4.2: Missing Secret Fail-Safe**
    
    If the application detects that `GITHUB_WEBHOOK_SECRET` is undefined or missing in the runtime environment during startup or request interception, it must immediately abort execution, log a critical error, and return a `500 Internal Server Error` rather than falling back to unverified processing.
    
      
    

## 5. Error Handling & Rejection Rules

- **Rule 5.1: Instant Rejection Status (`401 Unauthorized`)**
    
    Any request failing cryptographic verification must be terminated instantly with an HTTP `401 Unauthorized` response. Silent failures or fall-through routing are strictly forbidden.
    
      
    
- **Rule 5.2: Sanitized Error Responses**
    
    Error responses returned upon failed verification must remain generic (e.g., `Invalid webhook signature`) to prevent leaking internal hashing details, secret lengths, or architectural diagnostics to potential attackers.
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[cryptographicsecurity]]
    