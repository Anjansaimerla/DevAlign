# Feature Documentation: Customizable Markdown Digests

## 1. Feature Overview

- **Feature Name:** Customizable Markdown Digests
    
      
    
- **Module:** Notification & Formatting Engine
    
      
    
- **Objective:** Transform structured, categorized team activity metrics into clean, highly scannable Markdown templates optimized for direct rendering inside chat platforms like Discord and Slack.
    
      
    

## 2. Technical Mechanism & Architecture

Once the **Smart Categorization** engine compiles a team's activity summary for a given window, the **Customizable Markdown Digests** module acts as the layout formatter:

  

1. **Template Mapping:** Injects categorized arrays (_Completed Tasks_, _Active Work_, _Inactive Members_) into a pre-defined Markdown structural template.
    
      
    
2. **Platform Optimization:** Applies chat-safe formatting (using bolding, blockquotes, code spans, and emojis) to ensure high readability across different chat clients (Discord, Slack).
    
      
    
3. **Payload Packaging:** Wraps the resulting Markdown string inside the target platform's required JSON wrapper schema (e.g., `{ "content": "..." }` for Discord webhooks or `{ "text": "..." }` for Slack).
    
      
    

## 3. Step-by-Step Execution Flow & Template Structure

1. **Input Reception:** The formatting function receives the categorized object from the aggregation worker.
    
      
    
2. **String Interpolation:** The script dynamically builds sections:
    
      
    - **Header:** Team name and time window badge.
        
          
        
    - **Completed Milestones:** Bulleted list of merged pull requests and closed issues.
        
          
        
    - **Ongoing Momentum:** Recent commit messages and active branches.
        
          
        
    - **Blocker Flags:** Highlighted usernames of inactive members.
        
          
        
3. **Payload Dispatch:** The finalized Markdown text block is handed off to the outbound HTTP client for delivery.
    
      
    

### Standard Digest Template Example

Markdown

```
🚀 **DevAlign Daily Sync Digest** | *Team: Vignan Coders*
*Time Window: Past 24 Hours*

---

### ✅ Completed Tasks (2)
* **anjan-dev**: Merged PR #14 (*"feat: add github webhook signature verification"*)
* **rahul-tech**: Closed Issue #8 (*"fix database connection timeout"* )

### 🛠️ Active Work (3)
* **anjan-dev**: pushed 3 commits to `main` (*"refactor auth middleware"* )
* **kiran-code**: Opened PR #15 (*"ui: build lead dashboard metrics view"*)

### ⚠️ Inactive / Blocked Flags (1)
* **priya-dev**: Zero commits logged in the past 72 hours.
```

## 4. Implementation Code Pattern (Node.js)

JavaScript

```
function generateMarkdownDigest(teamName, categorizationData) {
  const { completedTasks, activeWork, inactiveMembers } = categorizationData;

  let markdown = `🚀 **DevAlign Daily Sync Digest** | *Team: ${teamName}*\n`;
  markdown += `*Generated at: ${new Date().toUTCString()}*\n\n`;
  markdown += `---\n\n`;

  // Section 1: Completed Tasks
  markdown += `### ✅ Completed Tasks (${completedTasks.length})\n`;
  if (completedTasks.length === 0) {
    markdown += `*No tasks completed in this window.*\n\n`;
  } else {
    completedTasks.forEach(task => {
      markdown += `* **${task.author}**: ${task.title}\n`;
    });
    markdown += `\n`;
  }

  // Section 2: Active Work
  markdown += `### 🛠️ Active Work (${activeWork.length})\n`;
  if (activeWork.length === 0) {
    markdown += `*No active work logged.*\n\n`;
  } else {
    activeWork.forEach(work => {
      markdown += `* **${work.author}**: ${work.message || work.title}\n`;
    });
    markdown += `\n`;
  }

  // Section 3: Inactive / Blocked Members
  if (inactiveMembers && inactiveMembers.length > 0) {
    markdown += `### ⚠️ Inactive / Blocked Flags (${inactiveMembers.length})\n`;
    inactiveMembers.forEach(member => {
      markdown += `* **${member}**: Zero commits or PRs logged over the threshold window.\n`;
    });
    markdown += `\n`;
  }

  return markdown;
}

module.exports = { generateMarkdownDigest };
```

## 5. Security & Engineering Guardrails

- **String Escape & Sanitization:** User-provided commit messages or PR titles containing raw Markdown characters must be properly escaped or safely handled to prevent layout distortion or injection formatting attacks inside chat channels.
    
      
    
- **Payload Size Constraints:** Chat platforms enforce hard character limits on incoming webhook payloads (e.g., Discord's 2000-character limit). Digest generators must truncate or summarize overly long commit lists to prevent delivery failure.
    
      
    
- **Stateless Formatting:** Formatting functions must remain pure and stateless—taking data objects as input and returning clean strings without relying on external system side effects.
  
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[customdigestsrules]]
- [[chatintegration]]
- 