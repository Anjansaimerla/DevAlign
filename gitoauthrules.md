# Rules & Engineering Guardrails: GitHub OAuth Authentication

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** GitHub OAuth Authentication (Supabase Auth)
    
      
    
- **Objective:** Establish strict security mandates, token management standards, scope restrictions, and access control rules for user authentication and workspace provisioning.
    
      
    

## 2. Session & Token Security Rules

- **Rule 2.1: Secure Client-Side Session Storage**
    
    Authentication session tokens and JWTs issued by Supabase must be stored securely (using encrypted browser storage or HttpOnly cookies) to prevent token theft via cross-site scripting (XSS) vulnerabilities.
    
      
    
- **Rule 2.2: Automatic Session Invalidation**
    
    The application must gracefully handle expired tokens or revoked GitHub access sessions, prompting the user to re-authenticate without crashing the frontend state or leaking sensitive data.
    
      
    

## 3. Scope & Least Privilege Rules

- **Rule 3.1: Strict Minimal Scope Enforcement**
    
    OAuth requests must strictly request only the permissions necessary for core functionality (`read:user`, `user:email`, and repository access `repo`). Requesting administrative or broader organizational scopes beyond operational necessity is strictly prohibited.
    
      
    
- **Rule 3.2: Explicit Consent Transparency**
    
    The authentication flow must clearly communicate to users why GitHub permissions are required (e.g., verifying repository access to link webhooks).
    
      
    

## 4. Database & RLS Access Control Rules

- **Rule 4.1: Mandatory `auth.uid()` Mapping**
    
    Every authenticated database operation executed from the frontend must tie back to the authenticated user's unique identifier (`auth.uid()`), ensuring user sessions cannot execute unverified queries.
    
      
    
- **Rule 4.2: Supabase RLS Policy Alignment**
    
    The user identity established via GitHub OAuth must map directly to Supabase Row-Level Security (RLS) policies across all tables (`teams`, `repositories`, `activity_logs`, `integrations`) to guarantee cross-tenant data isolation.
    
      
    

## 5. Error Handling & Redirect Rules

- **Rule 5.1: Graceful OAuth Cancellation Handling**
    
    If a user cancels the GitHub OAuth consent flow or encounters an error during redirection, the frontend must catch the callback error gracefully, display a clear message, and return the user to the login state without breaking the UI.
    
      
    
- **Rule 5.2: Validated Redirect URL Configuration**
    
    OAuth redirect URIs (`redirectTo`) must be strictly validated against allowed environment configurations to prevent open redirect vulnerabilities where malicious actors could hijack authorization tokens.
    
    
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[gitoauth]]
    