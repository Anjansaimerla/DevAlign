# Feature Documentation: Automated Activity Aggregation

## 1. Feature Overview

- **Feature Name:** Automated Activity Aggregation
    
      
    
- **Module:** Background Processing Engine / Cron Worker
    
      
    
- **Objective:** Periodically process raw, unparsed GitHub event logs stored in Supabase, group them by team and time window, and transform them into structured, human-readable metrics ready for chat distribution.
    
      
    

## 2. Technical Mechanism & Architecture

Raw GitHub webhooks captured by the ingestion gateway are stored as immutable `JSONB` blobs in the `activity_logs` table. The Automated Activity Aggregation engine acts as a scheduled background consumer (e.g., triggered via a Node-cron job or Supabase Edge Function) that:

  

1. Queries logs created within a specific time boundary (e.g., the past 24 hours).
    
      
    
2. Parses JSON payloads to extract meaningful commit messages, pull request states, and author usernames.
    
      
    
3. Classifies activity into three distinct buckets: _Completed Tasks_, _Active Work_, and _Inactive/Blocked Members_.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Schedule Trigger:** A cron worker triggers execution at a designated interval (e.g., daily at 18:00 UTC).
    
      
    
2. **Team Iteration:** The script fetches all active teams and their linked repositories from Supabase.
    
      
    
3. **Log Retrieval:** For each team, the worker queries `activity_logs` where `created_at` falls within the target time window (e.g., `NOW() - INTERVAL '24 hours'`).
    
      
    
4. **Parsing & Categorization:** The aggregation script iterates through the JSONB payloads:
    
      
    - **Completed Tasks:** Merged pull requests (`pull_request.merged == true`) and closed issues.
        
          
        
    - **Active Work:** Open pull requests and recent commits pushed to active branches.
        
          
        
    - **Inactive Members:** Contributors with zero commits or PR events logged over a 72-hour threshold.
        
          
        
5. **Digest Preparation:** The categorized metrics are compiled into structured data objects or Markdown templates, ready for the notification dispatcher.
    
      
    

## 4. Implementation Code Pattern (Node.js / Cron Worker)

JavaScript

```
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function aggregateDailyActivityForTeam(teamId) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch raw activity logs for the team from the last 24 hours
    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', twentyFourHoursAgo);

    if (error) throw error;

    // 2. Initialize categorized summary structures
    const summary = {
      completedTasks: [],
      activeWork: [],
      contributors: new Set()
    };

    // 3. Parse JSONB payloads
    logs.forEach(log => {
      const payload = log.payload_summary;
      summary.contributors.add(log.actor_github_username);

      if (log.event_type === 'push') {
        payload.commits?.forEach(commit => {
          summary.activeWork.push({
            author: log.actor_github_username,
            message: commit.message
          });
        });
      } else if (log.event_type === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        summary.completedTasks.push({
          author: log.actor_github_username,
          title: payload.pull_request.title
        });
      }
    });

    console.log(`Aggregated summary for team ${teamId}:`, summary);
    return summary;
  } catch (err) {
    console.error(`Failed to aggregate activity for team ${teamId}:`, err);
    return null;
  }
}

module.exports = { aggregateDailyActivityForTeam };
```

## 5. Security & Engineering Guardrails

- **Stateless Worker Design:** Aggregation workers must remain entirely stateless, fetching data dynamically from Supabase and terminating upon completion without relying on local server storage.
    
      
    
- **Isolated Error Handling:** If parsing a corrupted or unexpected JSONB payload throws an error, a `try/catch` block must catch the exception, log the specific log ID, and allow the worker to continue processing other teams.
    
      
    
- **Idempotent Aggregation Runs:** Running the aggregation script multiple times for the same time window must safely overwrite or update existing digests without duplicating task counts.
  
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
  [[automatedactivityrules]]
- [[smartcategorization]]
- 