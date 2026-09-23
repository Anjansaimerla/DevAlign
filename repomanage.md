# Feature Documentation: Repository Management

## 1. Feature Overview

- **Feature Name:** Repository Management
    
      
    
- **Module:** Frontend Dashboard & Core Backend Integration Layer
    
      
    
- **Objective:** Enable team leads and project managers to link, manage, configure, and monitor specific GitHub repositories (`owner/repo`) associated with their organizational workspace, ensuring seamless webhook event routing.
    
      
    

## 2. Technical Mechanism & Architecture

The **Repository Management** module bridges the gap between user workspaces and tracked GitHub codebases:

  

1. **Workspace Association:** Links specific GitHub repositories to a team via the Supabase `repositories`relational table.
    
      
    
2. **Identifier Mapping:** Stores unique GitHub repository IDs (`github_repo_id`) alongside full repository names (`owner/repo`) to prevent naming collision issues during renames.
    
      
    
3. **Webhook Provisioning Integration:** Provides the target repository webhook endpoint (`[https://api.devalign.com/api/webhooks/github](https://api.devalign.com/api/webhooks/github)`) required to configure event forwarding on GitHub.
    
      
    

## 3. Step-by-Step Execution Flow

1. **Repository Selection:** The team lead navigates to the dashboard repository management tab and selects a repository from their authorized GitHub account list.
    
      
    
2. **Database Insertion:** The frontend sends a secure REST request to insert the repository record into the Supabase `repositories` table, tied to the active `team_id`.
    
      
    
3. **Webhook Setup Instructions:** The interface provides automated guidance or API triggers to configure the webhook target URL and secret on the target GitHub repository settings.
    
      
    
4. **Active Status Verification:** Once webhooks are active, incoming events (`push`, `pull_request`, `issues`) start flowing into the ingestion pipeline for that specific repository binding.
    
      
    

## 4. Implementation Code Pattern (Next.js / Supabase)

JavaScript

```
// Example Next.js Component for Linking a GitHub Repository
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function RepositoryManager({ teamId, onRepoLinked }) {
  const [repoName, setRepoName] = useState('');
  const [githubRepoId, setGithubRepoId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLinkRepository = async (e) => {
    e.preventDefault();
    if (!repoName || !githubRepoId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('repositories')
        .insert([
          { team_id: teamId, repo_name: repoName, github_repo_id: parseInt(githubRepoId) }
        ])
        .select();

      if (error) throw error;

      setRepoName('');
      setGithubRepoId('');
      if (onRepoLinked) onRepoLinked(data[0]);
    } catch (err) {
      console.error('Failed to link repository:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLinkRepository} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Link New GitHub Repository</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Repository Name (owner/repo)</label>
          <input 
            type="text" 
            value={repoName} 
            onChange={(e) => setRepoName(e.target.value)} 
            placeholder="e.g., anjan-dev/devalign"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Repository ID</label>
          <input 
            type="number" 
            value={githubRepoId} 
            onChange={(e) => setGithubRepoId(e.target.value)} 
            placeholder="e.g., 123456789"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'Linking Repository...' : 'Link Repository'}
        </button>
      </div>
    </form>
  );
}
```

## 5. Security & Engineering Guardrails

- **Row-Level Security (RLS) Enforcement:** All repository queries and insertions must be strictly governed by Supabase RLS policies tied to the user's authorized `team_id`, preventing unauthorized cross-tenant repository linking.
    
      
    
- **Unique Constraint Safeguards:** The `github_repo_id` column must enforce a unique constraint at the database level to prevent duplicate repository bindings across multiple teams.
    
      
    
- **Cascading Deletes:** Foreign key relationships between `teams` and `repositories` must be defined with `ON DELETE CASCADE` so deleting a team workspace automatically cleans up all associated repository linkages.
  
  
    [[PRD]]
- [[TRD]]
- [[systemarchitecture]]
- [[rules]]
- [[repomanagerules]]
- [[metrics]]
- 