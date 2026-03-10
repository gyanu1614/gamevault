'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function TestConnectionPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult(null)

    const results: any = {
      envVars: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
        urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
        keyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...'
          : 'NOT SET',
      },
      tests: {}
    }

    try {
      const supabase = createClient()

      // Test 1: Can we connect?
      console.log('Test 1: Testing Supabase connection...')
      const { data: healthCheck, error: healthError } = await supabase
        .from('games')
        .select('count')
        .limit(1)

      results.tests.connection = healthError
        ? `❌ Failed: ${healthError.message}`
        : '✅ Connected to Supabase'

      // Test 2: Can we read from games table?
      console.log('Test 2: Reading games table...')
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .limit(1)

      results.tests.gamesTable = gamesError
        ? `❌ Failed: ${gamesError.message}`
        : `✅ Can read games (found ${games?.length || 0} games)`

      // Test 3: Can we read from profiles table?
      console.log('Test 3: Reading profiles table...')
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)

      results.tests.profilesTable = profilesError
        ? `❌ Failed: ${profilesError.message}`
        : `✅ Can read profiles (found ${profiles?.length || 0} profiles)`

      // Test 4: Check if trigger function exists
      console.log('Test 4: Checking trigger...')
      const { data: functions, error: functionsError } = await supabase.rpc('version' as any)
      results.tests.trigger = '⚠️ Cannot check trigger from client (check in Supabase dashboard)'

    } catch (err: any) {
      results.tests.criticalError = `❌ Critical Error: ${err.message}`
    }

    setResult(results)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">🔍 Supabase Connection Test</h1>

        <Button
          onClick={testConnection}
          disabled={loading}
          className="mb-8"
        >
          {loading ? 'Testing...' : 'Run Connection Test'}
        </Button>

        {result && (
          <div className="space-y-6">
            {/* Environment Variables */}
            <div className="rounded-lg border border-white/20 bg-white/5 p-6">
              <h2 className="mb-4 text-2xl font-bold">Environment Variables</h2>
              <div className="space-y-2 font-mono text-sm">
                <div>
                  <strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {result.envVars.url}
                  <div className="ml-4 text-gray-400">{result.envVars.urlValue}</div>
                </div>
                <div>
                  <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {result.envVars.key}
                  <div className="ml-4 text-gray-400">{result.envVars.keyPreview}</div>
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="rounded-lg border border-white/20 bg-white/5 p-6">
              <h2 className="mb-4 text-2xl font-bold">Test Results</h2>
              <div className="space-y-3 font-mono text-sm">
                {Object.entries(result.tests).map(([key, value]) => (
                  <div key={key} className="rounded border border-white/10 bg-black/50 p-3">
                    <strong className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</strong>
                    <div className="mt-1">{value as string}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-6">
              <h2 className="mb-4 text-2xl font-bold text-yellow-500">What to do next?</h2>
              <div className="space-y-2 text-sm">
                {result.envVars.url === '❌ Missing' && (
                  <div className="text-red-400">
                    ❌ <strong>CRITICAL:</strong> Environment variables are missing!
                    Check QUICK-FIX.md for instructions.
                  </div>
                )}
                {result.tests.connection?.startsWith('❌') && (
                  <div className="text-red-400">
                    ❌ <strong>Cannot connect to Supabase!</strong> Check:
                    <ul className="ml-6 mt-2 list-disc">
                      <li>Is your Supabase project active? (not paused)</li>
                      <li>Is the URL correct in .env.local?</li>
                      <li>Is the anon key correct in .env.local?</li>
                    </ul>
                  </div>
                )}
                {result.tests.profilesTable?.startsWith('❌') && (
                  <div className="text-orange-400">
                    ⚠️ <strong>Profiles table issue!</strong> Run /supabase/fix-auth.sql in Supabase SQL Editor
                  </div>
                )}
                {result.tests.connection?.startsWith('✅') && result.tests.profilesTable?.startsWith('✅') && (
                  <div className="text-green-400">
                    ✅ <strong>Everything looks good!</strong> Try signing up again.
                    If it still fails, check browser console for detailed errors.
                  </div>
                )}
              </div>
            </div>

            {/* Console Logs */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-6">
              <h2 className="mb-4 text-2xl font-bold text-blue-500">📝 Check Browser Console</h2>
              <p className="text-sm">
                Open DevTools (F12 or Cmd+Option+I) → Console tab to see detailed logs
              </p>
            </div>
          </div>
        )}

        {/* Instructions before test */}
        {!result && !loading && (
          <div className="rounded-lg border border-white/20 bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-bold">Instructions</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>Click "Run Connection Test" button above</li>
              <li>Wait for results to appear</li>
              <li>Open browser console (F12) to see detailed logs</li>
              <li>Follow the instructions based on test results</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
