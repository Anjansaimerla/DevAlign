# Rules & Engineering Guardrails: Environment-Based Secret Management

## 1. Document Overview

- **Project Name:** DevAlign (TeamSync Digest)
    
      
    
- **Feature Module:** Environment-Based Secret Management
    
      
    
- **Objective:** Establish strict security mandates, namespace separation standards, version control exclusion rules, and runtime validation safeguards for handling sensitive application credentials.
    
      
    

## 2. Namespace & Client/Server Separation Rules

- **Rule 2.1: Strict Client/Server Boundary Enforcement**
    
    Sensitive server-side credentials (such as `SUPABASE_SERVICE_ROLE_KEY` and `GITHUB_WEBHOOK_SECRET`) must never be exposed to client-side browser bundles.
    
      
    
- **Rule 2.2: Mandatory `NEXT_PUBLIC_` Prefix Restriction**
    
    Any environment variable prefixed with `NEXT_PUBLIC_` is explicitly exposed to the client browser by Next.js. Prefixes of this nature are strictly reserved for public non-sensitive configurations (e.g., `NEXT_PUBLIC_SUPABASE_URL`) and must never be applied to secrets or private keys.
    
      
    

## 3. Version Control & Repository Safety Rules

- **Rule 3.1: Zero Hardcoded Credentials Policy**
    
    Hardcoding API keys, database connection strings, webhook secrets, or tokens directly into source code files is strictly prohibited under any circumstances.
    
      
    
- **Rule 3.2: Mandatory `.gitignore` Exclusion**
    
    All local environment files (`.env`, `.env.local`, `.env.production`) must be explicitly declared in the project's `.gitignore` file to prevent accidental credential commits to GitHub repositories.
    
      
    
- **Rule 3.3: Pre-Commit Secret Scanning**
    
    Developers and CI/CD pipelines should utilize automated secret scanning tools to intercept and block any accidental commits containing API tokens or private keys.
    
      
    

## 4. Runtime Validation & Startup Guards

- **Rule 4.1: Fail-Fast Startup Validation**
    
    Application server startup scripts must execute a validation check verifying that all mandatory environment variables are present and non-empty. If any critical secret is missing, the application must abort execution (`process.exit(1)`) immediately rather than running in an insecure state.
    
      
    
- **Rule 4.2: Production Environment Injection**
    
    In production environments, secrets must be injected securely via the hosting platform's encrypted secret manager (e.g., Vercel Project Settings, Supabase Vault, or Render Environment Variables) rather than static file deployments.
    
      
    

## 5. Least Privilege & Key Rotation Rules

- **Rule 5.1: Least Privilege Key Usage**
    
    Background workers and webhook ingestion gateways must operate using the minimum required permissions. Privileged keys (like the Supabase service role key) must be strictly isolated to trusted server contexts.
    
      
    
- **Rule 5.2: Secret Rotation Readiness**
    
    Integration secrets (such as GitHub webhook HMAC secrets) should be designed to support smooth rotation without requiring core architectural refactoring, allowing credentials to be updated securely in the event of a suspected leak.
        [[PRD]]
    [[TRD]]
    [[rules]]
    [[envsecret]]
    