/**
 * Listing Template Types
 *
 * Defines types for dynamic form fields in game-specific listings
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'email'
  | 'url'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

export interface BaseField {
  name: string
  type: FieldType
  label: string
  required?: boolean
  placeholder?: string
  helpText?: string
  defaultValue?: any
}

export interface TextField extends BaseField {
  type: 'text' | 'email' | 'url'
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface TextAreaField extends BaseField {
  type: 'textarea'
  minLength?: number
  maxLength?: number
  rows?: number
}

export interface NumberField extends BaseField {
  type: 'number'
  min?: number
  max?: number
  step?: number
}

export interface BooleanField extends BaseField {
  type: 'boolean'
  defaultValue?: boolean
}

export interface SelectField extends BaseField {
  type: 'select'
  options: SelectOption[]
}

export interface MultiSelectField extends BaseField {
  type: 'multiselect'
  options: SelectOption[]
  maxSelections?: number
}

export interface DateField extends BaseField {
  type: 'date'
  minDate?: string
  maxDate?: string
}

export type TemplateField =
  | TextField
  | TextAreaField
  | NumberField
  | BooleanField
  | SelectField
  | MultiSelectField
  | DateField

export interface ListingTemplate {
  id: string
  game_id: string
  category_id?: string
  template_name: string
  fields: TemplateField[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TemplateData {
  [key: string]: any
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  data?: TemplateData
}
