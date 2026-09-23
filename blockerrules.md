# Rules & Engineering Guardrails: Blocker & Inactivity Detection

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Blocker & Inactivity Detection Engine
    
      
    
- **Objective:** Establish strict threshold standards, validation rules, time-delta calculation laws, and notification guardrails for identifying and surfacing stalled workflows or dormant contributors.
    
      
    

## 2. Threshold & Timing Rules

- **Rule 2.1: Deterministic Inactivity Thresholds**
    
    Inactivity detection must rely on strict, configurable time windows (defaulting to a rolling 72-hour threshold). Arbitrary or hardcoded checks without adjustable boundaries are prohibited.
    
      
    
- **Rule 2.2: UTC-Standardized Timestamp Comparisons**
    
    All time-delta calculations comparing commit timestamps (`created_at`) against the current system time must use standardized UTC ISO strings to prevent timezone discrepancies or incorrect interval evaluations.
    
      
    
- **Rule 2.3: Weekend and Sprint Cadence Flexibility**
    
    The detection engine should support configurable cadence rules (or sprint-aware boundaries) to prevent false-positive blocker alerts during scheduled weekends or team-wide holidays.
    
      
    

## 3. Roster Validation & Data Accuracy Rules

- **Rule 3.1: Official Team Roster Cross-Referencing**
    
    Inactivity checks must strictly validate developer activity against the team's official roster stored in Supabase. Anonymous or unlinked GitHub contributors appearing in logs must not trigger false blocker flags for registered team members.
    
      
    
- **Rule 3.2: Graceful Handling of Zero Activity History**
    
    If a newly onboarded team member has zero recorded logs in the system, the detection algorithm must flag them appropriately or provide a grace period without throwing runtime exceptions.
    
      
    
- **Rule 3.3: Read-Only Evaluation Mandate**
    
    Blocker and inactivity calculations must execute as pure in-memory operations over fetched activity log sets. Mutating or overwriting historical database records during inactivity scans is strictly forbidden.
    
      
    

## 4. Digest Integration & Formatting Rules

- **Rule 4.1: Constructive Blocker Presentation**
    
    Inactive or stalled team members flagged by the detection engine must be presented in the Markdown digest under a dedicated warning section (`⚠️ Inactive / Blocked Flags`) in a clear, professional, and non-punitive tone.
    
      
    
- **Rule 4.2: Prevention of Alert Fatigue**
    
    To prevent notification spam, inactive flags should summarize stalled contributors concisely without flooding chat channels with repetitive warnings for the same individual across consecutive cycles unless configured.
    
      
    

## 5. Performance & Statelessness Rules

- **Rule 5.1: Memory-Efficient Timestamp Mapping**
    
    When processing large log sets to find the latest activity timestamp per developer, developers must use optimized hash maps or dictionary structures to maintain $O(n)$ time complexity.
    
      
    
- **Rule 5.2: Stateless Worker Execution**
    
    Inactivity detection functions must remain entirely stateless, accepting roster arrays and log records as inputs and returning structured warning lists as outputs without relying on global state or external side effects.
    
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[blocker]]
    
    