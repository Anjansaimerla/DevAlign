# Rules & Engineering Guidelines: DevAlign

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Document Version:** 1.0
    
      
    
- **Objective:** Establish strict coding standards, workflow rules, architecture guardrails, and security mandates to ensure clean execution during development.
    
      
    

## 2. Code Quality & Architectural Rules

- **Rule 1: Documentation-First Workflow (Obsidian Protocol)**
    
    All new features, database schema adjustments, or API endpoint modifications must be planned and mapped out in Markdown notes within the Obsidian vault before implementation in the codebase.
    
      
    
- **Rule 2: Asynchronous Webhook Processing**
    
    The GitHub webhook receiver (`/api/webhooks/github`) must never execute heavy database writes, data parsing loops, or outbound HTTP requests _before_ replying. It must validate the signature, return an immediate `200 OK`, and handle tasks asynchronously.
    
      
    
- **Rule 3: Strict Error Boundary Isolation**
    
    Every integration request (Notion, GitHub API, Discord/Slack webhooks) must be wrapped in `try/catch`blocks. An external API failure must log the error gracefully without crashing the Node.js server process.
    
      
    
- **Rule 4: Environment Variable Security**
    
    Hardcoding secrets, database keys, or webhook secrets in source code files is strictly prohibited. All configuration must be loaded via `process.env` through a validated `.env` file.
    
      
    

## 3. Git & Version Control Rules

- **Commit Message Format:** Use clear, concise prefix-based commit messages:
    
      
    - `feat:` for new feature additions (e.g., `feat: add github webhook signature verification`)
        
          
        
    - `fix:` for bug fixes (e.g., `fix: resolve supabase connection timeout`)
        
          
        
    - `docs:` for markdown and documentation updates (e.g., `docs: update trd and rules spec`)
        
          
        
- **Branching Strategy:** Keep local development clean. Use a `main` branch strictly for production-ready code deployed to Vercel/Render, and feature branches for active sprint development.
    
      
    

## 4. Security & Compliance Rules

- **Signature Verification Enforcement:** No incoming webhook request from GitHub will be accepted without a valid cryptographic signature (`X-Hub-Signature-256`) checked via `crypto.timingSafeEqual`.
    
      
    
- **Database Access Control:** Client-side database queries must rely on Supabase Row-Level Security (RLS) policies to guarantee that users can only read or modify data tied to their authorized `team_id`.
  
  [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[sysrules]]
- 