# Feature Documentation: GitHub OAuth Authentication

## 1. Feature Overview

- **Feature Name:** GitHub OAuth Authentication
    
      
    
- **Module:** Frontend / Authentication Layer (Supabase Auth)
    
      
    
- **Objective:** Provide secure, passwordless user authentication via GitHub identities, establishing authenticated workspace sessions and linking user profiles to organizational teams and target repositories.
    
      
    

## 2. Technical Mechanism & Architecture

DevAlign delegates authentication and OAuth handshake management to **Supabase Auth**, eliminating the need for custom token exchange servers:

  

1. **Initiation:** The user clicks "Login with GitHub" on the Next.js frontend.
    
      
    
2. **OAuth Redirection:** Supabase Auth redirects the user to GitHub’s official OAuth consent screen requesting required scopes (`user:email`, `read:user`, `repo`).
    
      
    
3. **Authorization & Callback:** Upon user approval, GitHub redirects back to the Supabase auth callback handler with an authorization code.
    
      
    
4. **Token Exchange & Session Creation:** Supabase exchanges the code for an OAuth access token, provisions or updates the user record in `auth.users`, and issues a secure JSON Web Token (JWT) session to the client.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Sign-In Trigger:** User clicks the GitHub login button in the Next.js dashboard UI.
    
      
    
2. **Supabase Client Handshake:** The frontend invokes `supabase.auth.signInWithOAuth({ provider: 'github' })`.
    
      
    
3. **GitHub Authentication:** User authenticates on GitHub and grants repository access permissions.
    
      
    
4. **Session Establishment:** Supabase captures the GitHub profile data (username, avatar, email) and stores the active session token in secure browser storage/cookies.
    
      
    
5. **Dashboard Routing:** The Next.js router detects the active session state and redirects the user to their team management dashboard.
    
      
    

## 4. Implementation Code Pattern (Next.js / Supabase Client)

JavaScript

```
// Example Next.js Login Component using Supabase Auth
'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginButton() {
  const handleGitHubLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        console.error('GitHub OAuth login error:', error.message);
      }
    } catch (err) {
      console.error('Unexpected login exception:', err);
    }
  };

  return (
    <button 
      onClick={handleGitHubLogin}
      className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition"
    >
      <span>🔐</span> Sign in with GitHub
    </button>
  );
}
```

## 5. Security & Engineering Guardrails

- **Secure JWT Management:** Session tokens issued by Supabase must be stored securely using HttpOnly cookies or encrypted local storage to prevent cross-site scripting (XSS) token theft.
    
      
    
- **Row-Level Security (RLS) Integration:** Authenticated user sessions supply `auth.uid()`, which is directly evaluated by Supabase PostgreSQL RLS policies to guarantee that users can only access data belonging to their authorized `team_id`.
    
      
    
- **Minimal Scope Request:** The OAuth request must only request necessary permissions (`read:user`, `repo`) to maintain user trust and adhere to the principle of least privilege.
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- 
  [[gitoauthrules]]
- [[repomanage]]
- 