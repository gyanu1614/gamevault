/**
 * Listing Templates System
 *
 * Exports all template-related functionality
 */

// Types
export type {
  FieldType,
  SelectOption,
  BaseField,
  TextField,
  TextAreaField,
  NumberField,
  BooleanField,
  SelectField,
  MultiSelectField,
  DateField,
  TemplateField,
  ListingTemplate,
  TemplateData,
  ValidationError,
  ValidationResult
} from './types'

// Validation
export {
  validateTemplateData,
  getDefaultTemplateData
} from './validation'

// Template Manager
export {
  getTemplateFields,
  hasTemplate,
  getAllTemplateKeys,
  getGameTemplates,
  getGamesWithTemplates,
  getGameCategories,
  getTemplateStats
} from './template-manager'

// Individual Templates (for advanced usage)
export {
  robloxAccountTemplate,
  robloxCurrencyTemplate,
  robloxItemsTemplate
} from './roblox-template'

export {
  valorantAccountTemplate,
  valorantBoostingTemplate
} from './valorant-template'

export {
  fortniteAccountTemplate,
  fortniteCurrencyTemplate
} from './fortnite-template'

export {
  lolAccountTemplate,
  lolBoostingTemplate
} from './lol-template'

// Default export
export { default as templateManager } from './template-manager'
