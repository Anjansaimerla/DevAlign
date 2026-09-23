# Rules & Engineering Guardrails: Automated Activity Aggregation

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Automated Activity Aggregation Engine
    
      
    
- **Objective:** Establish rigid architectural constraints, data processing standards, and error-handling mandates for background workers that parse raw GitHub event logs into structured team metrics.
    
      
    

## 2. Worker Execution & Performance Rules

- **Rule 2.1: Stateless Worker Design Mandate**
    
    Background cron workers and aggregation routines must remain entirely stateless. They must fetch state dynamically from Supabase, process logs in memory, dispatch results, and terminate cleanly without relying on local server disk storage or persistent file caching.
    
      
    
- **Rule 2.2: Time-Bounded Query Windows**
    
    Aggregation queries must strictly enforce time-window boundaries (e.g., filtering logs explicitly where `created_at >= NOW() - INTERVAL '24 hours'`) to prevent unbounded memory consumption and database scanning bottlenecks as historical log sizes grow.
    
      
    
- **Rule 2.3: Non-Blocking Cron Scheduling**
    
    Scheduled aggregation routines must execute asynchronously in background intervals (e.g., via `node-cron` or serverless schedulers) and must never block the primary Express web server's request-response event loop.
    
      
    

## 3. Parsing & Data Categorization Rules

- **Rule 3.1: Safe JSONB Traversal & Optional Chaining**
    
    Because incoming webhook payloads can vary across event types (`push`, `pull_request`, `issues`), all JSONB payload parsing must use rigorous optional chaining (`?.`) and fallback defaults to prevent unhandled runtime errors (`TypeError: Cannot read properties of undefined`).
    
      
    
- **Rule 3.2: Strict Categorization Logic**
    
    Parsed metrics must strictly adhere to classification standards:
    
      
    - **Completed Tasks:** Restricted exclusively to merged pull requests (`pull_request.merged === true`) and explicitly closed issues.
        
          
        
    - **Active Work:** Open PRs, active branch pushes, and recent commit messages.
        
          
        
    - **Inactive Members:** Contributors flagged based on a zero-commit threshold over a defined period (e.g., 72 hours).
        
          
        
- **Rule 3.3: Read-Only Transformation Principle**
    
    Aggregation scripts must treat raw `activity_logs` records as read-only. Transforming and grouping logs into summaries must happen entirely in memory or into separate digest cache tables; modifying or overwriting raw event logs during aggregation is strictly forbidden.
    
      
    

## 4. Error Isolation & Fault Tolerance Rules

- **Rule 4.1: Multi-Tenant Error Isolation**
    
    When an aggregation worker processes multiple teams sequentially or in parallel, each team's processing block must be wrapped in an independent `try/catch` block. If parsing fails for one team due to corrupted JSON or database timeouts, it must log the error and allow the worker to continue processing remaining teams without halting execution.
    
      
    
- **Rule 4.2: Graceful Fallback on Missing Data**
    
    If a team has zero activity logs within the target time window, the aggregation engine must gracefully generate an empty state or a standardized "No activity recorded" summary rather than throwing an exception or crashing the worker process.
    
      
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[automatedactivity]]
    