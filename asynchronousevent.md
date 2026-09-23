# Feature Documentation: Asynchronous Event Processing

## 1. Feature Overview

- **Feature Name:** Asynchronous Event Processing
    
      
    
- **Module:** Backend API / Background Execution Engine
    
      
    
- **Objective:** Decouple incoming high-frequency GitHub webhook requests from heavy database writes, data parsing loops, and outbound network calls, ensuring the system remains responsive, non-blocking, and resilient under burst load.
    
      
    

## 2. Technical Mechanism & Architecture

To satisfy the **Zero-Blocking Ingestion Rule**, DevAlign separates request reception from event processing into two distinct execution tracks:

  

1. **Synchronous Fast Path (The Gateway):**
    
    Receives the webhook, verifies the cryptographic signature, sends an immediate `200 OK` response to GitHub within $<200\text{ms}$, and saves the raw payload into Supabase.
    
      
    
2. **Asynchronous Background Path (The Processor):**
    
    Pulls unprocessed logs from the database or an asynchronous task queue, parses event metadata, categorizes metrics, and handles outbound chat notifications without holding open the incoming HTTP request connection.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Webhook Reception:** GitHub fires an event payload to `POST /api/webhooks/github`.
    
      
    
2. **Signature Check & Fast Acknowledgment:** The Express server verifies the HMAC signature and immediately replies with `200 OK` (`{ status: "received" }`).
    
      
    
3. **Raw Storage Insertion:** Simultaneously, the raw event body and headers are inserted into the `activity_logs` table in Supabase with a processing status flag (e.g., `processed = false`).
    
      
    
4. **Background Queue / Job Trigger:** A background worker or cron routine picks up unprocessed logs asynchronously.
    
      
    
5. **Data Transformation & Aggregation:** The worker parses the JSONB payload (extracting commit messages, author usernames, and PR states) and prepares them for the daily digest.
    
      
    

## 4. Implementation Code Pattern (Node.js / Express)

JavaScript

```
// Example of Asynchronous Controller Pattern
async function handleGitHubWebhook(req, res) {
  const eventType = req.headers['x-github-event'];
  const payload = req.body;

  // 1. Send immediate response to GitHub (Zero-Blocking)
  res.status(200).json({ status: 'received', message: 'Event queued successfully.' });

  // 2. Offload heavy lifting to an asynchronous background task
  setImmediate(async () => {
    try {
      await processEventAsync(eventType, payload);
    } catch (err) {
      console.error('Background processing error:', err);
    }
  });
}

async function processEventAsync(eventType, payload) {
  // Simulate asynchronous database persistence and parsing
  console.log(`Processing event type: ${eventType} asynchronously...`);
  // Insert into Supabase activity_logs table here
}

module.exports = handleGitHubWebhook;
```

## 5. Security & Engineering Guardrails

- **Timeout Prevention:** By returning `200 OK` instantly, the server prevents GitHub from timing out or triggering redundant webhook delivery retries.
    
      
    
- **Error Isolation:** Because asynchronous background routines run outside the main HTTP request-response cycle, unhandled processing errors will not crash the Express server or return 500 errors back to GitHub.
    
      
    
- **Idempotency Safeguards:** Background workers must track processed event delivery IDs to ensure duplicate webhook pings do not duplicate analytics data.
  
  
    
  [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[asynchronouseventrules]]
- [[automatedactivity]]
- 