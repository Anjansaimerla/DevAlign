# Feature Documentation: Cryptographic Webhook Security

## 1. Feature Overview

- **Feature Name:** Cryptographic Webhook Security
    
      
    
- **Module:** Backend API / Edge Security Middleware
    
      
    
- **Objective:** Ensure that all incoming webhook requests originating from GitHub are cryptographically verified, protecting the DevAlign backend from spoofed payloads, unauthorized data injection, and malicious replay or timing attacks.
    
      
    

## 2. Technical Mechanism & Architecture

DevAlign implements **HMAC (Hash-based Message Authentication Code) with SHA-256** to verify webhook authenticity.

  

- **The Shared Secret:** A secure secret string (`GITHUB_WEBHOOK_SECRET`) is generated and shared exclusively between GitHub repository settings and the DevAlign environment variables.
    
      
    
- **The Signature Header:** Every webhook dispatched by GitHub includes an `X-Hub-Signature-256`header containing a hash calculated using the request body and the shared secret.
    
      
    
- **The Verification Check:** The Express backend intercepts the request, computes its own local HMAC signature using the raw payload body, and verifies it against the incoming header using a constant-time comparison algorithm.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Request Interception:** An HTTP POST request hits the endpoint (`/api/webhooks/github`).
    
      
    
2. **Header Inspection:** The security middleware checks for the presence of the `X-Hub-Signature-256`header. If absent, the request is rejected immediately with a `401 Unauthorized` status.
    
      
    
3. **Digest Computation:** The middleware retrieves the raw request body buffer and computes an HMAC SHA-256 hex digest using `process.env.GITHUB_WEBHOOK_SECRET`.
    
      
    
4. **Constant-Time Comparison:** To prevent timing-based side-channel attacks, the server compares the incoming signature string with the locally computed digest using `crypto.timingSafeEqual`.
    
      
    
5. **Authorization / Rejection:**
    
      
    - If signatures match perfectly, control is passed to the next route handler (`next()`).
        
          
        
    - If signatures mismatch, the server terminates the request pipeline and returns `401 Unauthorized`.
        
          
        

## 4. Implementation Code Snippet (Node.js / Express)

JavaScript

```
const crypto = require('crypto');

function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing X-Hub-Signature-256 header.' 
    });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CRITICAL: GITHUB_WEBHOOK_SECRET is not defined in environment variables.');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  try {
    // Compute local HMAC SHA-256 digest from raw request body
    const hmac = crypto.createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const digestBuffer = Buffer.from(digest, 'utf8');

    // Prevent timing attacks using constant-time buffer comparison
    if (
      signatureBuffer.length !== digestBuffer.length || 
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid webhook cryptographic signature.' 
      });
    }

    // Signature is valid; proceed to request handler
    next();
  } catch (err) {
    console.error('Signature verification error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = verifyGitHubSignature;
```

## 5. Security & Engineering Guardrails

- **Constant-Time Execution (`timingSafeEqual`):** Standard string comparison operators (`===`) leak timing information depending on where characters diverge, allowing attackers to guess secrets character-by-character. `crypto.timingSafeEqual` ensures comparison takes identical time regardless of validity.
    
      
    
- **Raw Body Parsing Protection:** The middleware must evaluate signatures against the raw JSON payload body prior to any structural object mutation or re-serialization.
    
      
    
- **Environment Isolation:** The webhook signing secret must reside strictly in runtime environment variables (`process.env.GITHUB_WEBHOOK_SECRET`) and must never be exposed in frontend bundles or repository code.
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]] 
  [[cryptorules]]
- [[asynchronousevent]]
- 