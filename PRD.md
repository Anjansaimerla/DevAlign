# Product Requirements Document (PRD): DevAlign

## 1. Product Overview

- **Product Name:** DevAlign (TeamSync Digest)
    
- **Document Version:** 1.0
    
- **Product Vision:** Eliminate administrative overhead and manual tracking friction for student clubs, hackathon squads, and dev teams by automatically aggregating GitHub activity and delivering structured status digests directly into existing chat workspaces.
    

## 2. Target Persona & User Stories

- **Primary Persona:** Student club leads, hackathon project managers, and technical coordinators.
    
- **User Stories:**
    
    - _As a project lead,_ I want my team's GitHub commits and PRs tracked automatically so I don't have to chase members for updates.
        
    - _As a team lead,_ I want a daily automated digest dropped into our Discord/Slack channel so everyone stays aligned without holding a status meeting.
        
    - _As a manager,_ I want a clean dashboard to view overall team velocity and identify who is blocked or inactive.
        

## 3. Functional Requirements

### 3.1 Authentication & Onboarding

- **FR-1.1:** Users must be able to authenticate securely using GitHub OAuth via Supabase Auth.
    
- **FR-1.2:** Users must be able to link and authorize repositories that they own or have admin access to.
    

### 3.2 Webhook Ingestion Engine

- **FR-2.1:** The backend must expose a secure public endpoint (`/api/webhooks/github`) to receive event payloads from GitHub.
    
- **FR-2.2:** The system must validate incoming webhook requests using HMAC SHA-256 signature verification to block unauthenticated or malicious calls.
    
- **FR-2.3:** The endpoint must acknowledge incoming webhooks instantly with a `200 OK` response before asynchronous processing begins.
    
- **FR-2.4:** The system must capture and store core event types: `push`, `pull_request` (opened, closed, merged), and `issues`.
    

### 3.3 Data Processing & Aggregation

- **FR-3.1:** The system must parse raw JSON payloads to extract metadata: actor username, commit messages, PR titles, and timestamps.
    
- **FR-3.2:** A background aggregation routine must group activity logs by team and time window (e.g., past 24 hours).
    
- **FR-3.3:** The engine must classify activity into clear categories: _Completed Tasks_, _Active Work_, and _Inactive/Blocked Members_.
    

### 3.4 Delivery & Notification Engine

- **FR-4.1:** The system must format aggregated data into clean, scannable Markdown templates optimized for chat applications.
    
- **FR-4.2:** The system must push the formatted digest via HTTP POST requests to configured Discord or Slack incoming webhook URLs.
    

### 3.5 Lead Control Dashboard

- **FR-5.1:** The frontend dashboard must display a list of connected repositories and team members.
    
- **FR-5.2:** The dashboard must display real-time or historical activity metrics, team velocity indicators, and inactive user warnings.
    

## 4. Non-Functional Requirements

- **Reliability:** Webhook ingestion must handle burst traffic safely without crashing the Node.js server.
    
- **Security:** Database communication must be encrypted via Supabase RLS (Row Level Security), and API secrets must reside strictly in environment variables (`.env`).
    
- **Performance:** Webhook acknowledgment must occur within under 200ms to satisfy GitHub delivery timeout windows.
    

## 5. Release Milestones & Scope Boundaries

- **MVP Scope (In-Scope):** GitHub event ingestion, basic database logging, automated Markdown formatting, and Discord/Slack webhook dispatch.
    
- **Post-MVP Scope (Out-of-Scope for 7-Day Sprint):** Notion task board bi-directional syncing, custom email digests, and automated WhatsApp bot delivery.
  [[TRD]]
- [[systemarchitecture]]
- [[sysrules]]
- [[rules]]

- 