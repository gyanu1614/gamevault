'use client'

import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SystemStatusProps {}

export default function SystemStatus({}: SystemStatusProps) {
  const [status, setStatus] = useState({
    database: 'checking',
    storage: 'checking',
    auth: 'checking',
  })

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    const supabase = createClient()

    // Check database
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      setStatus(prev => ({ ...prev, database: error ? 'error' : 'online' }))
    } catch {
      setStatus(prev => ({ ...prev, database: 'error' }))
    }

    // Check storage
    try {
      const { error } = await supabase.storage.listBuckets()
      setStatus(prev => ({ ...prev, storage: error ? 'error' : 'online' }))
    } catch {
      setStatus(prev => ({ ...prev, storage: 'error' }))
    }

    // Check auth
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setStatus(prev => ({ ...prev, auth: user ? 'online' : 'error' }))
    } catch {
      setStatus(prev => ({ ...prev, auth: 'error' }))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'checking':
        return <AlertCircle className="w-4 h-4 text-yellow-500 animate-pulse" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Operational'
      case 'error':
        return 'Error'
      case 'checking':
        return 'Checking...'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-700 bg-green-50'
      case 'error':
        return 'text-red-700 bg-red-50'
      case 'checking':
        return 'text-yellow-700 bg-yellow-50'
      default:
        return 'text-gray-700 bg-gray-50'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.database)}
            <span className="text-sm font-medium text-gray-900">Database</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(status.database)}`}>
            {getStatusText(status.database)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.storage)}
            <span className="text-sm font-medium text-gray-900">Storage</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(status.storage)}`}>
            {getStatusText(status.storage)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.auth)}
            <span className="text-sm font-medium text-gray-900">Authentication</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(status.auth)}`}>
            {getStatusText(status.auth)}
          </span>
        </div>
      </div>

      {/* Last Check */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={checkSystemStatus}
          className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
        >
          Refresh Status
        </button>
      </div>
    </div>
  )
}