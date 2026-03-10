import Link from 'next/link'
import { FileText, MessageSquare, Users, AlertTriangle, Settings, BarChart3 } from 'lucide-react'

interface QuickActionsProps {
  pendingCount: number
}

export default function QuickActions({ pendingCount }: QuickActionsProps) {
  const actions = [
    {
      label: 'Review Applications',
      description: `${pendingCount} pending`,
      href: '/admin/sellers?status=pending',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Check Disputes',
      description: 'View open cases',
      href: '/admin/disputes?status=open',
      icon: MessageSquare,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'User Management',
      description: 'Manage users',
      href: '/admin/users',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className="block p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${action.bgColor}`}>
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 group-hover:text-indigo-600">
                    {action.label}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {action.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}