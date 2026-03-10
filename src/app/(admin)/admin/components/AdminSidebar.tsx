'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  Shield,
  Store,
  AlertTriangle,
  UserCheck,
  ChevronRight,
  Star
} from 'lucide-react'

type UserRole = 'admin' | 'moderator' | 'support' | 'super_admin'
type BadgeType = string

interface AdminSidebarProps {
  admin: {
    role: UserRole
    username: string | null
    full_name: string | null
    badges: BadgeType[]
  }
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  badge?: string
}

export default function AdminSidebar({ admin }: AdminSidebarProps) {
  const pathname = usePathname()

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      roles: ['admin', 'moderator', 'support', 'super_admin']
    },
    {
      name: 'Seller Applications',
      href: '/admin/sellers',
      icon: FileText,
      roles: ['admin', 'moderator', 'super_admin']
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      roles: ['admin', 'super_admin']
    },
    {
      name: 'Active Sellers',
      href: '/admin/active-sellers',
      icon: Store,
      roles: ['admin', 'moderator', 'support', 'super_admin']
    },
    {
      name: 'Disputes',
      href: '/admin/disputes',
      icon: MessageSquare,
      roles: ['admin', 'support', 'super_admin']
    },
    {
      name: 'Reviews',
      href: '/admin/reviews',
      icon: Star,
      roles: ['admin', 'moderator', 'support', 'super_admin']
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      roles: ['admin', 'super_admin']
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      roles: ['super_admin']
    },
  ]

  const filteredNav = navigation.filter(item =>
    item.roles.includes(admin.role)
  )

  // Role badge colors and icons
  const roleBadgeConfig = {
    super_admin: {
      color: 'bg-purple-100 text-purple-700',
      icon: Shield,
      label: 'Super Admin'
    },
    admin: {
      color: 'bg-blue-100 text-blue-700',
      icon: UserCheck,
      label: 'Admin'
    },
    moderator: {
      color: 'bg-green-100 text-green-700',
      icon: AlertTriangle,
      label: 'Moderator'
    },
    support: {
      color: 'bg-yellow-100 text-yellow-700',
      icon: MessageSquare,
      label: 'Support'
    }
  }

  const roleConfig = roleBadgeConfig[admin.role as keyof typeof roleBadgeConfig]
  const RoleIcon = roleConfig?.icon || Shield

  return (
    <aside className="fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        {/* Admin Info Section */}
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${roleConfig?.color || 'bg-gray-100'}`}>
              <RoleIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {admin.full_name || admin.username || 'Admin'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {roleConfig?.label}
              </p>
              {/* Badges */}
              {admin.badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {admin.badges.includes('verified') && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      ✓ Verified
                    </span>
                  )}
                  {admin.badges.includes('developer') && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Dev
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href ||
                           (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className={`
                  w-5 h-5 flex-shrink-0 transition-colors
                  ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-indigo-400" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Quick Stats */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Pending Reviews</span>
              <span className="font-semibold text-gray-900">-</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Open Disputes</span>
              <span className="font-semibold text-gray-900">-</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Active Sellers</span>
              <span className="font-semibold text-gray-900">-</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}