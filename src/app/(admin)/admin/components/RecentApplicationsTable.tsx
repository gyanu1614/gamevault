'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface Application {
  id: string
  display_name: string
  seller_type: 'individual' | 'business'
  status: string
  fraud_score: number
  created_at: string
  submitted_at?: string
  country: string
}

interface RecentApplicationsTableProps {
  applications: Application[]
}

export default function RecentApplicationsTable({ applications }: RecentApplicationsTableProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      info_requested: 'bg-orange-100 text-orange-800',
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[status as keyof typeof statusConfig] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getFraudScoreBadge = (score: number) => {
    let colorClass = 'bg-green-100 text-green-800'
    if (score > 70) colorClass = 'bg-red-100 text-red-800'
    else if (score > 40) colorClass = 'bg-yellow-100 text-yellow-800'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {score}%
      </span>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No applications to review
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Applicant
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Submitted
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {applications.map((app) => (
            <tr key={app.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {app.display_name}
                  </div>
                  <div className="text-sm text-gray-500">{app.country}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900 capitalize">{app.seller_type}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(app.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getFraudScoreBadge(app.fraud_score)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {app.submitted_at
                  ? formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })
                  : 'Not submitted'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/admin/sellers/${app.id}`}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}