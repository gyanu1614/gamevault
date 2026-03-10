/**
 * Dynamic Field Renderer
 *
 * Renders form fields dynamically based on template field definitions
 */

'use client'

import React from 'react'
import type { TemplateField, TemplateData } from '@/lib/templates'

interface DynamicFieldRendererProps {
  fields: TemplateField[]
  values: TemplateData
  onChange: (name: string, value: any) => void
  errors?: Record<string, string>
  disabled?: boolean
}

export function DynamicFieldRenderer({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false
}: DynamicFieldRendererProps) {
  if (!fields || fields.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <label
            htmlFor={field.name}
            className="block text-sm font-medium text-white"
          >
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>

          {renderField(field, values[field.name], onChange, disabled)}

          {field.helpText && !errors[field.name] && (
            <p className="text-xs text-gray-400">{field.helpText}</p>
          )}

          {errors[field.name] && (
            <p className="text-xs text-red-400">{errors[field.name]}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function renderField(
  field: TemplateField,
  value: any,
  onChange: (name: string, value: any) => void,
  disabled: boolean
): React.ReactNode {
  const baseClasses =
    'w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'

  const errorClasses = 'border-red-500 focus:ring-red-500'

  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <input
          type={field.type}
          id={field.name}
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          maxLength={'maxLength' in field ? field.maxLength : undefined}
          pattern={'pattern' in field ? field.pattern : undefined}
          className={baseClasses}
        />
      )

    case 'textarea':
      return (
        <textarea
          id={field.name}
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          maxLength={'maxLength' in field ? field.maxLength : undefined}
          rows={'rows' in field ? field.rows : 4}
          className={`${baseClasses} resize-none`}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          id={field.name}
          name={field.name}
          value={value ?? ''}
          onChange={(e) => {
            const numValue = e.target.value === '' ? undefined : Number(e.target.value)
            onChange(field.name, numValue)
          }}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          min={'min' in field ? field.min : undefined}
          max={'max' in field ? field.max : undefined}
          step={'step' in field ? field.step : 1}
          className={baseClasses}
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={field.name}
            name={field.name}
            checked={value || false}
            onChange={(e) => onChange(field.name, e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 rounded border-white/[0.1] bg-white/[0.05] text-violet-500 focus:ring-2 focus:ring-violet-500 focus:ring-offset-0"
          />
          <label htmlFor={field.name} className="text-sm text-gray-300">
            {field.helpText || 'Enable this option'}
          </label>
        </div>
      )

    case 'select':
      return (
        <select
          id={field.name}
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          disabled={disabled}
          required={field.required}
          className={baseClasses}
        >
          <option value="">Select an option...</option>
          {'options' in field &&
            field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.description && ` - ${option.description}`}
              </option>
            ))}
        </select>
      )

    case 'multiselect':
      return (
        <div className="space-y-2">
          {'options' in field &&
            field.options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  name={field.name}
                  value={option.value}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : []
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v) => v !== option.value)
                    onChange(field.name, newValues)
                  }}
                  disabled={disabled}
                  className="w-4 h-4 rounded border-white/[0.1] bg-white/[0.05] text-violet-500 focus:ring-2 focus:ring-violet-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-gray-400">{option.description}</div>
                  )}
                </div>
              </label>
            ))}
          {'maxSelections' in field && field.maxSelections && (
            <p className="text-xs text-gray-400">
              Max selections: {field.maxSelections}
              {Array.isArray(value) && value.length > 0 && (
                <span className="ml-1">
                  ({value.length}/{field.maxSelections})
                </span>
              )}
            </p>
          )}
        </div>
      )

    case 'date':
      return (
        <input
          type="date"
          id={field.name}
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          disabled={disabled}
          required={field.required}
          min={'minDate' in field ? field.minDate : undefined}
          max={'maxDate' in field ? field.maxDate : undefined}
          className={baseClasses}
        />
      )

    default:
      return <div className="text-sm text-gray-400">Unsupported field type</div>
  }
}

export default DynamicFieldRenderer
