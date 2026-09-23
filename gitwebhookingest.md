# Feature Documentation: Automated GitHub Webhook Ingestion

## 1. Feature Overview

- **Feature Name:** Automated GitHub Webhook Ingestion
    
      
    
- **Module:** Backend API / Event Gateway
    
      
    
- **Objective:** Capture developer activity (`push`, `pull_request`, and `issues`) in real time directly from GitHub repositories without requiring manual team status updates or polling loops.
    
      
    

## 2. Technical Workflow & Architecture

When a developer performs an action on a connected GitHub repository, the ingestion engine executes a strict asynchronous lifecycle:

  

1. **Event Trigger:** A developer pushes code, opens a pull request, or closes an issue on GitHub.
    
      
    
2. **HTTP POST Dispatch:** GitHub’s servers send an encrypted HTTP POST request to the public webhook endpoint: `[https://api.devalign.com/api/webhooks/github](https://api.devalign.com/api/webhooks/github)`.
    
      
    
3. **Security Check (Signature Verification):** The Express middleware intercepts the request, reads the `X-Hub-Signature-256` header, and verifies its cryptographic integrity.
    
      
    
4. **Instant Acknowledgment (`200 OK`):** To comply with GitHub's timeout window, the server returns an immediate `200 OK` status response within $<200\text{ms}$.
    
      
    
5. **Asynchronous Persistence:** The raw JSON payload is safely logged into the Supabase `activity_logs`table for downstream background processing.
    
      
    

## 3. Technical Specifications & API Contract

### Endpoint Definition

- **Route:** `POST /api/webhooks/github`
    
      
    
- **Content-Type:** `application/json`
    
      
    

### Required Headers

- `X-GitHub-Event`: Specifies the event type (e.g., `push`, `pull_request`, `issues`).
    
      
    
- `X-Hub-Signature-256`: HMAC SHA-256 cryptographic signature hex string used for payload verification.
    
      
    
- `X-GitHub-Delivery`: Unique UUID for the specific delivery attempt (used for idempotency tracking).
    
      
    

### Expected Payload Structure (Example: `push`)

JSON

```
{
  "ref": "refs/heads/main",
  "commits": [
    {
      "id": "c4b3a2...",
      "message": "feat: add user authentication",
      "author": {
        "username": "anjan-dev",
        "email": "anjan@example.com"
      }
    }
  ],
  "repository": {
    "id": 123456789,
    "full_name": "anjan-dev/devalign"
  }
}
```

### Response Contract

- **Success Response:** `200 OK`
    
      
    
    JSON
    
    ```
    {
      "status": "success",
      "message": "Webhook received and queued successfully."
    }
    ```
    
- **Unauthorized Response:** `401 Unauthorized`
    
      
    
    JSON
    
    ```
    {
      "error": "Invalid webhook signature."
    }
    ```
    

## 4. Security Implementation: HMAC SHA-256 Verification

To prevent unauthorized or malicious payloads from hitting the database, every incoming request must be cryptographically validated:

  

JavaScript

```
const crypto = require('crypto');

function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header.' });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  next();
}
```

## 5. Reliability & Error Handling Guidelines

- **Zero Blocking Rule:** Heavy database aggregation, data parsing loops, or outbound chat notifications must _never_ execute inside this endpoint. Only raw persistence or job queueing is permitted.
    
      
    
- **Idempotency Protection:** If GitHub retries a delivery due to a transient network drop, the unique delivery ID (`X-GitHub-Delivery`) or commit hash validation ensures duplicate events do not corrupt team analytics.
    
      
    
- **Database Isolation:** Raw JSON payloads are stored inside immutable `JSONB` columns in Supabase so that future schema changes or parser updates can re-process historical logs without data loss.
  
  [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[gitwebhookingestrules]]
- [[cryptographicsecurity]]
- 