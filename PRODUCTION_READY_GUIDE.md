# 🚀 Production-Ready Guide (No Third-Party Services)

This guide shows how to make your app production-ready using **only open-source tools and built-in features**.

---

## ✅ **What We've Added**

### 1. **Error Handling & Logging**
- ✅ Custom logger (`lib/logger.ts`)
- ✅ Error boundary component (`components/common/error-boundary.tsx`)
- ✅ Log storage in Supabase (`app/api/logs/route.ts`)

### 2. **Rate Limiting**
- ✅ In-memory rate limiter (`lib/rate-limit.ts`)
- ✅ Per-endpoint rate limits
- ✅ IP-based and user-based limiting

### 3. **Request Validation**
- ✅ Type-safe validators (`lib/validation.ts`)
- ✅ Validation helpers for API routes

### 4. **Testing**
- ✅ Unit test example (`lib/__tests__/validation.test.ts`)

---

## 📦 **Setup Instructions**

### Step 1: Create Logs Table in Supabase

Run this SQL in your Supabase SQL editor:

\`\`\`sql
-- Create logs table
CREATE TABLE logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id),
  user_agent text,
  environment text
);

-- Add indexes for performance
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_user_id ON logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_logs_context ON logs USING gin(context);

-- Enable RLS (optional - for viewing logs in dashboard)
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert logs
CREATE POLICY "Service role can insert logs"
  ON logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view logs"
  ON logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_preferences
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
\`\`\`

### Step 2: Install Testing Dependencies

\`\`\`bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
\`\`\`

Add to \`package.json\`:

\`\`\`json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.js"],
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    }
  }
}
\`\`\`

Create \`jest.setup.js\`:

\`\`\`javascript
import '@testing-library/jest-dom'
\`\`\`

---

## 🔧 **Usage Examples**

### Example 1: Update API Route with All Features

\`\`\`typescript
// app/api/props/table/route.ts
import { withRateLimit } from '@/lib/rate-limit'
import { withValidation, validateSport, validateScope, validateType, validateMarket } from '@/lib/validation'
import { logger, measurePerformance } from '@/lib/logger'

interface Params {
  sport: string
  scope: string
  type: string
  market: string
}

async function handler(req: Request, params: Params) {
  return measurePerformance(
    'fetch-props-table',
    async () => {
      try {
        logger.info('Fetching props table', params)
        
        // Your existing logic here
        const data = await fetchPropsFromRedis(params)
        
        return Response.json(data)
      } catch (error) {
        logger.error('Failed to fetch props table', error, params)
        throw error
      }
    },
    params
  )
}

// Wrap with validation and rate limiting
export const GET = withRateLimit(
  withValidation<Params>(
    {
      sport: validateSport,
      scope: validateScope,
      type: validateType,
      market: validateMarket,
    },
    handler
  )
)
\`\`\`

### Example 2: Wrap Components with Error Boundary

\`\`\`tsx
// app/(protected)/odds/[sport]/page.tsx
import { ErrorBoundary } from '@/components/common/error-boundary'

export default function OddsPage() {
  return (
    <ErrorBoundary>
      <SportOddsContent sport={sport} />
    </ErrorBoundary>
  )
}
\`\`\`

### Example 3: Use Logger in Components

\`\`\`tsx
// components/odds-screen/tables/odds-table.tsx
import { logger, measurePerformance } from '@/lib/logger'

const handleSSEUpdate = useCallback(async (message: any) => {
  return measurePerformance(
    'sse-update',
    async () => {
      try {
        // Your update logic
        const updatedItems = await processUpdate(message)
        setData(updatedItems)
        
        logger.info('SSE update successful', {
          rowCount: updatedItems.length,
          sport,
          scope
        })
      } catch (error) {
        logger.error('SSE update failed', error, { sport, scope })
        // Show user-friendly error
        toast.error('Failed to update odds')
      }
    },
    { sport, scope }
  )
}, [sport, scope])
\`\`\`

---

## 📊 **Monitoring Dashboard (DIY)**

### Create a Simple Logs Viewer

\`\`\`tsx
// app/(protected)/admin/logs/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/libs/supabase/client'

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  
  useEffect(() => {
    const supabase = createClient()
    
    const fetchLogs = async () => {
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (filter !== 'all') {
        query = query.eq('level', filter)
      }
      
      const { data } = await query
      setLogs(data || [])
    }
    
    fetchLogs()
    
    // Real-time subscription
    const subscription = supabase
      .channel('logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'logs'
      }, fetchLogs)
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [filter])
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Application Logs</h1>
      
      <div className="mb-4 flex gap-2">
        {['all', 'error', 'warn', 'info'].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={\`px-4 py-2 rounded \${filter === level ? 'bg-brand text-white' : 'bg-neutral-200'}\`}
          >
            {level.toUpperCase()}
          </button>
        ))}
      </div>
      
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={\`p-4 rounded border \${
              log.level === 'error' ? 'border-red-500 bg-red-50' :
              log.level === 'warn' ? 'border-yellow-500 bg-yellow-50' :
              'border-neutral-200 bg-white'
            }\`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-xs text-neutral-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
                <p className="font-medium mt-1">{log.message}</p>
                {log.context && Object.keys(log.context).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-neutral-600">
                      Context
                    </summary>
                    <pre className="mt-1 text-xs bg-neutral-100 p-2 rounded overflow-auto">
                      {JSON.stringify(log.context, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <span className={\`px-2 py-1 rounded text-xs font-medium \${
                log.level === 'error' ? 'bg-red-200 text-red-800' :
                log.level === 'warn' ? 'bg-yellow-200 text-yellow-800' :
                'bg-blue-200 text-blue-800'
              }\`}>
                {log.level}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
\`\`\`

---

## 🎯 **Cost Breakdown**

| Feature | Third-Party Cost | Our Solution | Cost |
|---------|-----------------|--------------|------|
| Error Monitoring | Sentry: $26/mo | Supabase logs | $0 |
| Rate Limiting | Upstash: $10/mo | In-memory | $0 |
| Logging | DataDog: $15/mo | Supabase | $0 |
| Testing | None | Jest (built-in) | $0 |
| Validation | None | Custom validators | $0 |
| **Total** | **$51/mo** | **DIY Solution** | **$0** |

---

## 📈 **When to Upgrade to Paid Services**

Consider paid services when:

1. **>10,000 daily active users** - In-memory rate limiting won't scale
   - Upgrade to: Upstash Redis ($10/mo)

2. **>1M logs/month** - Supabase storage costs increase
   - Upgrade to: Sentry ($26/mo) or self-hosted Grafana Loki

3. **Need advanced features** - APM, distributed tracing, alerting
   - Upgrade to: DataDog, New Relic, or Sentry

4. **Multiple servers** - In-memory cache won't work across instances
   - Upgrade to: Redis (Upstash or Railway)

---

## ✅ **Next Steps**

1. ✅ Run the SQL to create the logs table
2. ✅ Wrap your main API routes with validation + rate limiting
3. ✅ Add error boundaries to critical components
4. ✅ Write tests for core business logic
5. ✅ Create the admin logs dashboard
6. ✅ Monitor for a week and iterate

**You're now production-ready without spending a dime on third-party services!** 🎉

