# Feature Documentation: Blocker & Inactivity Detection

## 1. Feature Overview

- **Feature Name:** Blocker & Inactivity Detection
    
      
    
- **Module:** Background Processing Engine / Analytics Layer
    
      
    
- **Objective:** Automatically identify stalled workflows, dormant contributors, and blocked tasks by evaluating team member activity against configurable time thresholds, surfacing potential bottlenecks proactively in the daily team digest.
    
      
    

## 2. Technical Mechanism & Architecture

The **Blocker & Inactivity Detection** module operates during the background aggregation and categorization phase:

  

1. **Roster Mapping:** Retrieves the official list of members associated with a team workspace from Supabase.
    
      
    
2. **Timestamp Evaluation:** Cross-references each member's latest recorded activity (`created_at` of pushes, pull requests, or issue updates) against the current timestamp.
    
      
    
3. **Threshold Checking:** Flags any team member whose inactivity duration exceeds a predefined safety window (e.g., zero commits or PRs logged over a rolling 72-hour threshold).
    
      
    
4. **Digest Integration:** Passes flagged inactive usernames into the _Inactive / Blocked Flags_ bucket for inclusion in the Markdown digest.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Aggregation Trigger:** The background cron worker initiates daily metrics processing for a team.
    
      
    
2. **Activity Timestamp Retrieval:** The engine queries recent `activity_logs` or scans the team's member roster to find the most recent activity timestamp for each developer.
    
      
    
3. **Delta Calculation:** For each member, the system calculates the time elapsed since their last recorded GitHub event (`Date.now() - lastActivityTimestamp`).
    
      
    
4. **Flag Generation:** If the elapsed time exceeds the 72-hour threshold, the member is categorized as inactive or potentially blocked.
    
      
    
5. **Digest Notification:** The flagged usernames are formatted into the warning section of the daily Slack or Discord status digest.
    
      
    

## 4. Implementation Code Pattern (Node.js)

JavaScript

```
function detectInactiveMembers(teamMembers, activityLogs, thresholdHours = 72) {
  const now = new Date();
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  
  // Map the latest activity timestamp for each team member
  const lastActiveMap = {};
  teamMembers.forEach(member => {
    lastActiveMap[member] = null;
  });

  activityLogs.forEach(log => {
    const author = log.actor_github_username;
    const logTime = new Date(log.created_at);

    if (author && teamMembers.includes(author)) {
      if (!lastActiveMap[author] || logTime > lastActiveMap[author]) {
        lastActiveMap[author] = logTime;
      }
    }
  });

  // Identify members exceeding the inactivity threshold
  const inactiveMembers = [];
  teamMembers.forEach(member => {
    const lastActive = lastActiveMap[member];
    const isInactive = !lastActive || (now - lastActive > thresholdMs);

    if (isInactive) {
      inactiveMembers.push({
        username: member,
        lastActive: lastActive ? lastActive.toISOString() : 'No recorded activity'
      });
    }
  });

  return inactiveMembers;
}

module.exports = { detectInactiveMembers };
```

## 5. Security & Engineering Guardrails

- **Configurable Thresholds:** Inactivity limits must be flexible (e.g., customizable per team or project sprint length) to accommodate varying project cadences without generating false-positive alerts.
    
      
    
- **Roster Validation Safeguards:** Detection algorithms must verify team roster integrity against Supabase records to ensure users who have left the organization are not flagged as active blockers.
    
      
    
- **Stateless Processing:** Inactivity checks must execute purely in-memory over fetched log sets without mutating historical database records.
  
   [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[blockerrules]]
- [[tenant]]
- 