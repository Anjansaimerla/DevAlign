# Rules & Engineering Guardrails: Smart Categorization

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Smart Categorization Engine
    
      
    
- **Objective:** Establish strict classification standards, data parsing rules, and structural boundaries governing how raw GitHub event logs are sorted into actionable team metrics.
    
      
    

## 2. Parsing & Safety Rules

- **Rule 2.1: Mandatory Optional Chaining for JSONB Traversals**
    
    Because GitHub webhook payloads vary significantly across event types (`push`, `pull_request`, `issues`), developers must use rigorous optional chaining (`?.`) and fallback defaults when reading nested properties. Assuming a property exists without checks is strictly prohibited.
    
      
    
- **Rule 2.2: Read-Only Log Transformation**
    
    Categorization functions must treat input activity logs as read-only. Sorting, filtering, and mapping logs into summary buckets must happen entirely in-memory or into temporary presentation objects; mutating or overwriting raw records in `activity_logs` is forbidden.
    
      
    
- **Rule 2.3: Graceful Malformed Payload Handling**
    
    If a log entry contains malformed or unexpected JSON data, the parser must catch the parsing anomaly internally, log a warning for debugging, skip the individual record, and continue processing the remaining log array without crashing the execution context.
    
      
    

## 3. Categorization Boundary Rules

- **Rule 3.1: Strict "Completed Tasks" Qualification**
    
    Items assigned to the _Completed Tasks_ bucket must satisfy verifiable closure criteria. A pull request must be explicitly verified as merged (`pull_request.merged === true` and `action === 'closed'`), and issues must be explicitly marked as closed. Unmerged or draft PRs are strictly barred from this bucket.
    
      
    
- **Rule 3.2: Clear Isolation of "Active Work"**
    
    The _Active Work_ bucket must be restricted exclusively to ongoing developmental momentum, such as active branch pushes containing commit message snippets and newly opened or synchronized pull requests. Finished milestones must never bleed into active work.
    
      
    
- **Rule 3.3: Deterministic Inactivity Thresholds**
    
    Flagging _Inactive / Blocked Members_ must rely on strict, deterministic time thresholds (e.g., zero commits or PR events recorded over a rolling 72-hour window) cross-referenced against the team's official roster to prevent false positives.
    
      
    

## 4. Performance & Memory Rules

- **Rule 4.1: In-Memory Set Operations**
    
    When tracking active contributors across large log sets, developers must utilize memory-efficient data structures like JavaScript `Set` objects to ensure unique username collections scale smoothly with high commit frequencies.
    
      
    
- **Rule 4.2: Stateless Categorization Functions**
    
    Categorization routines must remain completely stateless. They must accept raw log arrays and roster parameters as pure function inputs and return structured summary objects without maintaining external side effects or global state dependencies.
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[smartcategorization]]
    