# Rules & Engineering Guardrails: Customizable Markdown Digests

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Customizable Markdown Digests
    
      
    
- **Objective:** Establish strict layout formatting standards, character limit constraints, data sanitization rules, and architectural guardrails for generating chat-optimized status digests.
    
      
    

## 2. Formatting & Layout Rules

- **Rule 2.1: Strict Template Consistency**
    
    All generated Markdown digests must adhere to a standardized structural hierarchy (Header $\rightarrow$ Completed Tasks $\rightarrow$ Active Work $\rightarrow$ Inactive Flags) to ensure instant scannability for project leads across different teams.
    
      
    
- **Rule 2.2: Chat-Safe Markdown Elements**
    
    Formatters must stick exclusively to chat-compatible Markdown elements (such as bolding `**`, bullet points `*`, code spans `` ` `` for branches/commits, and blockquotes `>`). Complex HTML tags or unsupported syntax must be strictly avoided.
    
      
    
- **Rule 2.3: Visual Anchor Badges**
    
    Every digest header must incorporate consistent status emojis and visual dividers (`---`) to cleanly separate distinct sections and make updates easily digestible at a glance.
    
      
    

## 3. Payload Size & Truncation Rules

- **Rule 3.1: Strict Character Limit Enforcement**
    
    Target chat platforms impose hard limits on incoming webhook payloads (e.g., Discord’s 2000-character ceiling). Digest generators must calculate total string length prior to dispatch.
    
      
    
- **Rule 3.2: Intelligent List Truncation**
    
    If a repository experiences massive burst activity resulting in an overly long commit list, the formatter must gracefully truncate the list (e.g., displaying the top 10 items followed by _"and 15 more commits..."_) to prevent HTTP delivery rejection or message truncation failures.
    
      
    

## 4. Data Sanitization & Safety Rules

- **Rule 4.1: User-Input Sanitization**
    
    Commit messages and pull request titles authored by developers can contain raw Markdown characters (such as asterisks, backticks, or headers). Formatters must escape or safely wrap these strings to prevent malicious or accidental layout breaking inside chat channels.
    
      
    
- **Rule 4.2: Fallback for Empty States**
    
    If a team has zero activity or completed tasks during the target window, the formatter must output a clean, standardized empty state message (_"No tasks completed in this window"_) rather than breaking the layout or omitting sections entirely.
    
      
    

## 5. Architectural & Statelessness Rules

- **Rule 5.1: Pure Function Design Mandate**
    
    Digest formatting functions must be designed as pure, stateless functions. They must accept structured categorization objects as input and return raw Markdown strings as output, without executing external database queries or side effects.
    
      
    
- **Rule 5.2: Separation of Formatting and Dispatch**
    
    The generation of the Markdown string must be strictly decoupled from the outbound HTTP request client. Formatting logic must execute independently so strings can be tested, mocked, or previewed without firing network requests.
    
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[customisabledigests]]
    