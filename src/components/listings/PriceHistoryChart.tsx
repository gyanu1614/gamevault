/**
 * Price History Chart Component
 *
 * Displays listing price changes over time using a line chart
 * Shows price volatility and statistics
 */

'use client'

import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import {
  getListingPriceTrend,
  getListingPriceStats,
  getPriceVolatility,
  type PriceStats
} from '@/lib/api/price-history'

interface PriceHistoryChartProps {
  listingId: string
  days?: number
  showStats?: boolean
  height?: number
  variant?: 'line' | 'area'
}

interface ChartData {
  date: string
  price: number
  formattedDate: string
}

export function PriceHistoryChart({
  listingId,
  days = 30,
  showStats = true,
  height = 300,
  variant = 'area'
}: PriceHistoryChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [stats, setStats] = useState<PriceStats | null>(null)
  const [volatility, setVolatility] = useState<{
    score: number
    description: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPriceData()
  }, [listingId, days])

  async function loadPriceData() {
    setLoading(true)
    setError(null)

    try {
      // Load price trend data
      const trendResult = await getListingPriceTrend(listingId, days)

      if (!trendResult.success || !trendResult.data) {
        setError(trendResult.error || 'Failed to load price data')
        setLoading(false)
        return
      }

      // Format data for chart
      const formatted = trendResult.data.map(item => ({
        ...item,
        formattedDate: formatDate(item.date)
      }))

      setChartData(formatted)

      // Load stats if enabled
      if (showStats) {
        const [statsResult, volatilityResult] = await Promise.all([
          getListingPriceStats(listingId),
          getPriceVolatility(listingId)
        ])

        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data)
        }

        if (volatilityResult.success) {
          setVolatility({
            score: volatilityResult.score || 0,
            description: volatilityResult.description || 'Stable'
          })
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading price data:', err)
      setError('Unexpected error loading price data')
      setLoading(false)
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function formatPrice(value: number): string {
    return `$${value.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
        <div className="flex items-center justify-center h-[300px]">
          <div className="text-gray-400">Loading price history...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
        <div className="flex items-center justify-center h-[300px]">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
        <div className="flex items-center justify-center h-[300px]">
          <div className="text-gray-400">No price history available</div>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-white/[0.1] rounded-lg p-3 shadow-xl">
          <p className="text-sm text-gray-400 mb-1">{payload[0].payload.formattedDate}</p>
          <p className="text-lg font-semibold text-white">
            {formatPrice(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Price History</h3>
          <p className="text-sm text-gray-400 mt-1">
            Last {days} days
          </p>
        </div>

        {volatility && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.05] rounded-lg">
            <Activity className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-gray-300">{volatility.description}</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formattedDate"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickFormatter={formatPrice}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formattedDate"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickFormatter={formatPrice}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      {showStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.05]">
          <StatCard
            label="Current Price"
            value={formatPrice(stats.currentPrice)}
            icon={null}
          />
          <StatCard
            label="Lowest Price"
            value={formatPrice(stats.lowestPrice)}
            icon={<TrendingDown className="w-4 h-4 text-red-400" />}
            valueColor="text-red-400"
          />
          <StatCard
            label="Highest Price"
            value={formatPrice(stats.highestPrice)}
            icon={<TrendingUp className="w-4 h-4 text-green-400" />}
            valueColor="text-green-400"
          />
          <StatCard
            label="Average Price"
            value={formatPrice(stats.averagePrice)}
            icon={null}
          />
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  icon?: React.ReactNode
  valueColor?: string
}

function StatCard({ label, value, icon, valueColor = 'text-white' }: StatCardProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-lg font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

export default PriceHistoryChart
