/**
 * Static Field Display
 *
 * Displays template data in read-only mode without needing onChange handlers
 */

'use client'

import React from 'react'
import type { TemplateField, TemplateData } from '@/lib/templates'

interface StaticFieldDisplayProps {
  fields: TemplateField[]
  values: TemplateData
}

export function StaticFieldDisplay({ fields, values }: StaticFieldDisplayProps) {
  if (!fields || fields.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => {
        const value = values[field.name]
        if (value === undefined || value === null || value === '') return null

        return (
          <div key={field.name} className="space-y-1">
            <div className="text-sm font-medium text-gray-400">
              {field.label}
            </div>
            <div className="text-base text-white">
              {formatValue(field, value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatValue(field: TemplateField, value: any): string {
  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No'

    case 'number':
      if (typeof value !== 'number') return String(value)
      return value.toLocaleString()

    case 'date':
      if (!value) return ''
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return String(value)
      }

    case 'multiselect':
      if (!Array.isArray(value)) return String(value)
      return value.join(', ')

    case 'select':
      if ('options' in field) {
        const option = field.options.find(opt => opt.value === value)
        return option ? option.label : String(value)
      }
      return String(value)

    default:
      return String(value)
  }
}

export default StaticFieldDisplay
