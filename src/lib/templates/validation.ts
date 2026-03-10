/**
 * Template Field Validation
 *
 * Validates template field data against field definitions
 */

import type {
  TemplateField,
  TemplateData,
  ValidationError,
  ValidationResult,
  TextField,
  TextAreaField,
  NumberField,
  SelectField,
  MultiSelectField
} from './types'

export function validateTemplateData(
  fields: TemplateField[],
  data: TemplateData
): ValidationResult {
  const errors: ValidationError[] = []

  for (const field of fields) {
    const value = data[field.name]

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field.name,
        message: `${field.label} is required`
      })
      continue
    }

    // Skip validation if field is not required and empty
    if (!field.required && (value === undefined || value === null || value === '')) {
      continue
    }

    // Validate based on field type
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'textarea':
        validateTextInput(field as TextField | TextAreaField, value, errors)
        break

      case 'number':
        validateNumberInput(field as NumberField, value, errors)
        break

      case 'boolean':
        validateBooleanInput(field, value, errors)
        break

      case 'select':
        validateSelectInput(field as SelectField, value, errors)
        break

      case 'multiselect':
        validateMultiSelectInput(field as MultiSelectField, value, errors)
        break

      case 'date':
        validateDateInput(field, value, errors)
        break

      default:
        break
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

function validateTextInput(
  field: TextField | TextAreaField,
  value: any,
  errors: ValidationError[]
): void {
  if (typeof value !== 'string') {
    errors.push({
      field: field.name,
      message: `${field.label} must be a string`
    })
    return
  }

  if ('minLength' in field && field.minLength && value.length < field.minLength) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at least ${field.minLength} characters`
    })
  }

  if ('maxLength' in field && field.maxLength && value.length > field.maxLength) {
    errors.push({
      field: field.name,
      message: `${field.label} cannot exceed ${field.maxLength} characters`
    })
  }

  if ('pattern' in field && field.pattern) {
    const regex = new RegExp(field.pattern)
    if (!regex.test(value)) {
      errors.push({
        field: field.name,
        message: `${field.label} format is invalid`
      })
    }
  }

  // Email validation
  if (field.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      errors.push({
        field: field.name,
        message: `${field.label} must be a valid email address`
      })
    }
  }

  // URL validation
  if (field.type === 'url') {
    try {
      new URL(value)
    } catch {
      errors.push({
        field: field.name,
        message: `${field.label} must be a valid URL`
      })
    }
  }
}

function validateNumberInput(
  field: NumberField,
  value: any,
  errors: ValidationError[]
): void {
  const numValue = Number(value)

  if (isNaN(numValue)) {
    errors.push({
      field: field.name,
      message: `${field.label} must be a number`
    })
    return
  }

  if (field.min !== undefined && numValue < field.min) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at least ${field.min}`
    })
  }

  if (field.max !== undefined && numValue > field.max) {
    errors.push({
      field: field.name,
      message: `${field.label} cannot exceed ${field.max}`
    })
  }

  if (field.step !== undefined && numValue % field.step !== 0) {
    errors.push({
      field: field.name,
      message: `${field.label} must be a multiple of ${field.step}`
    })
  }
}

function validateBooleanInput(
  field: TemplateField,
  value: any,
  errors: ValidationError[]
): void {
  if (typeof value !== 'boolean') {
    errors.push({
      field: field.name,
      message: `${field.label} must be true or false`
    })
  }
}

function validateSelectInput(
  field: SelectField,
  value: any,
  errors: ValidationError[]
): void {
  if (typeof value !== 'string') {
    errors.push({
      field: field.name,
      message: `${field.label} must be a string`
    })
    return
  }

  const validOptions = field.options.map(opt => opt.value)
  if (!validOptions.includes(value)) {
    errors.push({
      field: field.name,
      message: `${field.label} must be one of: ${validOptions.join(', ')}`
    })
  }
}

function validateMultiSelectInput(
  field: MultiSelectField,
  value: any,
  errors: ValidationError[]
): void {
  if (!Array.isArray(value)) {
    errors.push({
      field: field.name,
      message: `${field.label} must be an array`
    })
    return
  }

  const validOptions = field.options.map(opt => opt.value)
  for (const item of value) {
    if (typeof item !== 'string' || !validOptions.includes(item)) {
      errors.push({
        field: field.name,
        message: `${field.label} contains invalid options`
      })
      break
    }
  }

  if (field.maxSelections && value.length > field.maxSelections) {
    errors.push({
      field: field.name,
      message: `${field.label} can have at most ${field.maxSelections} selections`
    })
  }
}

function validateDateInput(
  field: TemplateField,
  value: any,
  errors: ValidationError[]
): void {
  const date = new Date(value)

  if (isNaN(date.getTime())) {
    errors.push({
      field: field.name,
      message: `${field.label} must be a valid date`
    })
  }
}

/**
 * Get default values for template fields
 */
export function getDefaultTemplateData(fields: TemplateField[]): TemplateData {
  const defaultData: TemplateData = {}

  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      defaultData[field.name] = field.defaultValue
    } else {
      // Set sensible defaults based on type
      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'email':
        case 'url':
          defaultData[field.name] = ''
          break
        case 'number':
          defaultData[field.name] = field.type === 'number' && (field as NumberField).min !== undefined
            ? (field as NumberField).min
            : 0
          break
        case 'boolean':
          defaultData[field.name] = false
          break
        case 'select':
          defaultData[field.name] = ''
          break
        case 'multiselect':
          defaultData[field.name] = []
          break
        case 'date':
          defaultData[field.name] = ''
          break
      }
    }
  }

  return defaultData
}
