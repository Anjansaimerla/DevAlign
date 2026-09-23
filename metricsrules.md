# Feature Documentation: Team Velocity & Metrics View

## 1. Feature Overview

- **Feature Name:** Team Velocity & Metrics View
    
      
    
- **Module:** Frontend Dashboard & Analytics Layer
    
      
    
- **Objective:** Provide project leads and team members with a real-time, visual dashboard displaying core development metrics—including pull request merge velocity, commit frequencies, and task completion trends—to monitor sprint health at a glance.
    
      
    

## 2. Technical Mechanism & Architecture

The **Team Velocity & Metrics View** aggregates historical activity logs stored in Supabase and renders them via interactive UI components in the Next.js dashboard:

  

1. **Database Aggregation / RPC:** Optimized PostgreSQL queries or Supabase remote procedure calls (RPC) calculate metrics on the fly (e.g., counts of merged PRs, active commits, and active contributors over a 7-day or 30-day window).
    
      
    
2. **Client-Side Rendering:** Next.js client components fetch the structured metrics and render them into visual cards and progress charts.
    
      
    
3. **Multi-Tenant Scoping:** All metrics queries are strictly isolated by `team_id` using database Row-Level Security (RLS).
    
      
    

## 3. Step-by-Step Execution Flow

1. **Dashboard Access:** The user navigates to the DevAlign analytics dashboard for their team.
    
      
    
2. **Data Request:** The Next.js client component invokes a Supabase query or custom view to fetch aggregated velocity data for the active `team_id`.
    
      
    
3. **Metric Calculation:** Supabase executes grouped aggregations over the `activity_logs` table filtered by time boundaries.
    
      
    
4. **UI Rendering:** The frontend maps the returned statistics into clean metric cards (e.g., _Completed Tasks_, _Total Commits_, _Active Contributors_) and trend graphs.
    
      
    

## 4. Implementation Code Pattern (Next.js / Supabase)

JavaScript

```
// Example Next.js Component for Team Metrics & Velocity Dashboard
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function TeamVelocityMetrics({ teamId }) {
  const [metrics, setMetrics] = useState({ completedPRs: totalCommits: 0, activeMembers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeamMetrics() {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch logs for the past 7 days
        const { data: logs, error } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('team_id', teamId)
          .gte('created_at', sevenDaysAgo);

        if (error) throw error;

        // Compute metrics locally or from summary view
        let prCount = 0;
        let commitCount = 0;
        const contributors = new Set();

        logs.forEach(log => {
          if (log.actor_github_username) contributors.add(log.actor_github_username);
          if (log.event_type === 'pull_request' && log.payload_summary?.pull_request?.merged) {
            prCount++;
          }
          if (log.event_type === 'push') {
            commitCount += log.payload_summary?.commits?.length || 1;
          }
        });

        setMetrics({
          completedPRs: prCount,
          totalCommits: commitCount,
          activeMembers: contributors.size
        });
      } catch (err) {
        console.error('Failed to load team velocity metrics:', err.message);
      } finally {
        setLoading(false);
      }
    }

    if (teamId) fetchTeamMetrics();
  }, [teamId]);

  if (loading) return <div className="p-6 text-gray-500">Loading metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h4 className="text-sm font-medium text-gray-500">Completed PRs (7 Days)</h4>
        <p className="text-3xl font-bold text-gray-900 mt-2">✅ {metrics.completedPRs}</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h4 className="text-sm font-medium text-gray-500">Total Commits Pushed</h4>
        <p className="text-3xl font-bold text-gray-900 mt-2">💻 {metrics.totalCommits}</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h4 className="text-sm font-medium text-gray-500">Active Contributors</h4>
        <p className="text-3xl font-bold text-gray-900 mt-2">👥 {metrics.activeMembers}</p>
      </div>
    </div>
  );
}
```

## 5. Security & Engineering Guardrails

- **Database Indexing Optimization:** Tables queried for metrics must maintain proper composite indexes on `(team_id, created_at)` to ensure fast query execution as log volume scales.
    
      
    
- **Row-Level Security (RLS) Compliance:** All metric data requests must be validated against Supabase RLS policies to guarantee that users can only view statistics for teams they are explicitly authorized to access.
    
      
    
- **Efficient Data Payload Handling:** When dealing with large historical datasets, metric calculations should leverage PostgreSQL aggregate functions or pre-computed summary views rather than fetching raw JSONB arrays directly to the client browser.
  
  
    [[PRD]]
    [[TRD]]
    [[rules]]
    [[metrics]]
    