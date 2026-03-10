import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface DashboardStatCardProps {
  label: string
  value: number
  icon: LucideIcon
  color: string
  bgColor: string
  borderColor: string
  href: string
  trend?: number
}

export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  borderColor,
  href,
  trend,
}: DashboardStatCardProps) {
  return (
    <Link
      href={href}
      className={`block bg-white p-5 rounded-xl border ${borderColor} hover:shadow-md transition-all duration-200 group`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
          {value}
        </p>
      </div>
    </Link>
  )
}