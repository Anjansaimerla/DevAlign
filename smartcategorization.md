# Feature Documentation: Smart Categorization

## 1. Feature Overview

- **Feature Name:** Smart Categorization
    
      
    
- **Module:** Background Processing Engine / Data Analytics Layer
    
      
    
- **Objective:** Automatically parse raw GitHub activity logs (`JSONB` payloads) and logically sort team outputs into clear, actionable buckets (_Completed Tasks_, _Active Work_, and _Inactive/Blocked Members_) to give project leads immediate clarity without manual filtering.
    
      
    

## 2. Technical Mechanism & Architecture

Raw GitHub event data comes in various schemas depending on the event type (`push`, `pull_request`, `issues`). The **Smart Categorization** engine acts as a classification middleware that runs during the aggregation phase:

  

1. **Event Type Inspection:** Evaluates the `event_type` and payload actions (e.g., whether a pull request was opened, synchronized, or merged).
    
      
    
2. **Logical Filtering & Mapping:** Applies conditional business rules to sort items into structured output categories.
    
      
    
3. **Threshold Evaluation:** Identifies dormant contributors by cross-referencing commit timestamps against a defined inactivity window (e.g., 72 hours).
    
      
    

## 3. Step-by-Step Classification Logic

When the processing script iterates through a team's activity logs for a given time window, it routes data through specific classification rules:

  

### Bucket 1: Completed Tasks

- **Criteria:** Represents finished, high-value milestones that move the project forward.
    
      
    
- **Source Actions:**
    
      
    - Pull requests where `action === 'closed'` and `pull_request.merged === true`.
        
          
        
    - Issues marked as `closed`.
        
          
        
- **Extracted Data:** Author username, PR/Issue title, and unique URL.
    
      
    

### Bucket 2: Active Work

- **Criteria:** Represents ongoing development and active momentum.
    
      
    
- **Source Actions:**
    
      
    - Git pushes (`event_type === 'push'`) containing individual commit messages and author details.
        
          
        
    - Open pull requests (`action === 'opened'` or `action === 'synchronize'`).
        
          
        
- **Extracted Data:** Committer username, commit message snippets, and branch names.
    
      
    

### Bucket 3: Inactive / Blocked Members

- **Criteria:** Flags bottlenecks, stalled workflows, or team members who have gone quiet.
    
      
    
- **Source Actions:**
    
      
    - Cross-references team member rosters against activity logs over a rolling 72-hour window.
        
          
        
- **Extracted Data:** Usernames with zero commits or PR events recorded during the period.
    
      
    

## 4. Implementation Code Pattern (Node.js)

JavaScript

```
function categorizeActivityLogs(logs, teamMembers = []) {
  const categorization = {
    completedTasks: [],
    activeWork: [],
    activeContributors: new Set(),
    inactiveMembers: []
  };

  // 1. Parse and categorize each log entry
  logs.forEach(log => {
    const payload = log.payload_summary || {};
    const actor = log.actor_github_username;
    
    if (actor) {
      categorization.activeContributors.add(actor);
    }

    // Category A: Completed Tasks (Merged PRs)
    if (log.event_type === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
      categorization.completedTasks.push({
        author: actor,
        title: payload.pull_request.title,
        url: payload.pull_request.html_url
      });
    }

    // Category B: Active Work (Pushes & Open PRs)
    if (log.event_type === 'push') {
      payload.commits?.forEach(commit => {
        categorization.activeWork.push({
          author: actor,
          message: commit.message
        });
      });
    } else if (log.event_type === 'pull_request' && (payload.action === 'opened' || payload.action === 'reopened')) {
      categorization.activeWork.push({
        author: actor,
        title: `Opened PR: ${payload.pull_request.title}`
      });
    }
  });

  // Category C: Determine Inactive Members (if full roster is provided)
  teamMembers.forEach(member => {
    if (!categorization.activeContributors.has(member)) {
      categorization.inactiveMembers.push(member);
    }
  });

  return {
    completedTasks: categorization.completedTasks,
    activeWork: categorization.activeWork,
    inactiveMembers: categorization.inactiveMembers
  };
}

module.exports = { categorizeActivityLogs };
```

## 5. Security & Engineering Guardrails

- **Defensive Optional Chaining:** Because webhook payloads vary significantly between event types, parsing routines must use robust optional chaining (`payload.pull_request?.merged`) to prevent runtime crashes from missing properties.
    
      
    
- **Strict Classification Boundaries:** Blending active work into completed tasks is forbidden; a PR must be explicitly verified as merged before entering the _Completed Tasks_ bucket.
    
      
    
- **Stateless Processing:** Categorization logic must operate entirely in memory on immutable log arrays without modifying the underlying database records.
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[smartcategorizationrules]]
- [[customisabledigests]]
- 