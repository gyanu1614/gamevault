'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Store,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Activity,
  Eye,
  ArrowRight,
  Calendar,
  Shield,
  Bell,
  ChevronRight,
  Sparkles,
  BarChart3,
  Zap,
  MapPin,
  Mail,
  Phone,
  Gamepad2,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DashboardProps {
  admin: any
  stats: any
  recentApplications: any[]
}

export default function BentoGridDashboard({ admin, stats, recentApplications }: DashboardProps) {
  const router = useRouter()
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome Header - Flat */}
      <motion.div
        variants={item}
        className="mb-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl font-bold text-white">
                Welcome back, {admin.full_name || admin.username || 'Admin'}
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
                <Shield className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-violet-300 text-xs font-medium capitalize">
                  {admin.role.replace('_', ' ')}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Platform overview for today
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Bell className="h-4 w-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-medium">
              {stats.pending || 0} pending
            </span>
          </div>
        </div>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-[140px]">

        {/* Pending Review - Smaller Card */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 md:col-span-2 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-yellow-500/30 transition-all duration-300 cursor-pointer"
          )}
          onMouseEnter={() => setHoveredCard('pending')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <Link href="/admin/sellers?status=pending" className="block h-full p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 h-full flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <motion.p
                    animate={{
                      scale: hoveredCard === 'pending' ? 1.05 : 1,
                    }}
                    className="text-3xl font-bold text-white"
                  >
                    {stats.pending || 0}
                  </motion.p>
                  <h3 className="text-sm font-medium text-white">Pending Review</h3>
                  <p className="text-xs text-gray-400">Applications waiting for your review</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-yellow-400 group-hover:translate-x-1 transition-transform">
                <span className="text-xs font-medium">Review Now</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Approved Today */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-green-500/30 transition-all duration-300 cursor-pointer"
          )}
        >
          <Link href="/admin/sellers?status=approved" className="block h-full p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center gap-3 h-full">
              <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.approvedToday || 0}
                </p>
                <p className="text-xs text-gray-400">Approved Today</p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Rejected */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-red-500/30 transition-all duration-300 cursor-pointer"
          )}
        >
          <Link href="/admin/sellers?status=rejected" className="block h-full p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center gap-3 h-full">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.rejected || 0}
                </p>
                <p className="text-xs text-gray-400">Total Rejected</p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Active Sellers - Wide Card */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 md:col-span-2 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-purple-500/30 transition-all duration-300"
          )}
        >
          <div className="p-4 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center justify-between h-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Store className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.activeSellers || 0}
                  </p>
                  <p className="text-xs text-gray-400">Active Sellers</p>
                </div>
              </div>

              {/* Mini Chart */}
              <div className="flex items-end gap-1 h-10">
                {[40, 70, 45, 90, 65, 80, 95].map((height, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-purple-400/50 rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Total Users */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-indigo-500/30 transition-all duration-300"
          )}
        >
          <div className="p-4 h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center gap-3 h-full">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalUsers || 0}
                </p>
                <p className="text-xs text-gray-400">Total Users</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Open Disputes */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "group relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]",
            "hover:border-orange-500/30 transition-all duration-300 cursor-pointer"
          )}
        >
          <Link href="/admin/disputes" className="block h-full p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex items-center gap-3 h-full">
              <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.openDisputes || 0}
                </p>
                <p className="text-xs text-gray-400">Open Disputes</p>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Recent Applications - Full Width */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 md:col-span-2 lg:col-span-4 row-span-1",
            "relative overflow-hidden rounded-xl",
            "bg-black/50 backdrop-blur-xl border border-white/[0.1]"
          )}
        >
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Recent Applications</h3>
              <Link
                href="/admin/sellers"
                className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 group transition-colors"
              >
                View all
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              {recentApplications.slice(0, 4).map((app, idx) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group h-full"
                >
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setClickPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                      })
                      setSelectedApplication(app)
                    }}
                    className={cn(
                      "flex flex-col gap-3 p-3 rounded-lg h-full w-full text-left",
                      "bg-white/[0.02] hover:bg-white/[0.05]",
                      "border border-white/[0.05] hover:border-violet-500/30",
                      "transition-all duration-200 cursor-pointer"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">
                          {app.display_name?.[0] || 'S'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium text-white truncate">
                          {app.display_name}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{app.country}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats - Bottom Row */}
        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "relative overflow-hidden rounded-xl",
            "bg-gradient-to-br from-violet-500/10 to-purple-500/10",
            "backdrop-blur-xl border border-white/[0.1]"
          )}
        >
          <div className="p-4 h-full flex flex-col justify-center items-center text-center">
            <BarChart3 className="h-6 w-6 text-violet-400 mb-1.5" />
            <p className="text-xl font-bold text-white">98%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Approval Rate</p>
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className={cn(
            "col-span-1 row-span-1",
            "relative overflow-hidden rounded-xl",
            "bg-gradient-to-br from-green-500/10 to-emerald-500/10",
            "backdrop-blur-xl border border-white/[0.1]"
          )}
        >
          <div className="p-4 h-full flex flex-col justify-center items-center text-center">
            <Zap className="h-6 w-6 text-green-400 mb-1.5" />
            <p className="text-xl font-bold text-white">1.2h</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Avg Response Time</p>
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className={cn(
            "col-span-1 md:col-span-2 row-span-1",
            "relative overflow-hidden rounded-xl",
            "bg-gradient-to-br from-indigo-500/10 to-blue-500/10",
            "backdrop-blur-xl border border-white/[0.1]"
          )}
        >
          <div className="p-4 h-full">
            <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-xs text-gray-400">Revenue This Month</p>
                <p className="text-2xl font-bold text-white">$24,582</p>
                <p className="text-[10px] text-green-400 mt-1">+12% from last month</p>
              </div>
              <DollarSign className="h-8 w-8 text-indigo-400/30" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Application Quick View Modal */}
      <AnimatePresence>
        {selectedApplication && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => {
                setSelectedApplication(null)
                setClickPosition(null)
              }}
            />

            {/* Modal Container - Responsive positioning */}
            <div className="fixed inset-0 lg:left-52 z-[60] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-lg bg-black/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto pointer-events-auto"
              >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                      <span className="text-white text-lg font-medium">
                        {selectedApplication.display_name?.[0] || 'S'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedApplication.display_name}
                      </h3>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize mt-1",
                        selectedApplication.status === 'pending' && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
                        selectedApplication.status === 'approved' && "bg-green-500/20 text-green-400 border border-green-500/30",
                        selectedApplication.status === 'rejected' && "bg-red-500/20 text-red-400 border border-red-500/30",
                        selectedApplication.status === 'under_review' && "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      )}>
                        {selectedApplication.status === 'pending' && <Clock className="h-3 w-3" />}
                        {selectedApplication.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                        {selectedApplication.status === 'rejected' && <XCircle className="h-3 w-3" />}
                        {selectedApplication.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                    <div className="flex items-center gap-2 text-white">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p className="text-sm">{selectedApplication.email || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                    <div className="flex items-center gap-2 text-white">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p className="text-sm">{selectedApplication.phone_number || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Country</p>
                    <div className="flex items-center gap-2 text-white">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="text-sm">{selectedApplication.country}</p>
                    </div>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Application Date</p>
                    <div className="flex items-center gap-2 text-white">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <p className="text-sm">
                        {new Date(selectedApplication.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {selectedApplication.primary_games && selectedApplication.primary_games.length > 0 && (
                    <div className="col-span-2 space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Games</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedApplication.primary_games.slice(0, 3).map((game: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium"
                          >
                            <Gamepad2 className="h-3 w-3" />
                            {game}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedApplication.documents_count !== undefined && (
                    <div className="col-span-2 space-y-1.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Documents</p>
                      <div className="flex items-center gap-2 text-white">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <p className="text-sm">{selectedApplication.documents_count || 0} files uploaded</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-white/[0.1]">
                  <button
                    onClick={() => {
                      setSelectedApplication(null)
                      setClickPosition(null)
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.1] text-gray-300 hover:bg-white/[0.05] transition-colors font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/admin/sellers/${selectedApplication.id}`)
                      setSelectedApplication(null)
                      setClickPosition(null)
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    View Full Application
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}