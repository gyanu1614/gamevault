/**
 * Light "Forest Ledger" form primitives.
 *
 * The site-wide Combobox / PhoneInput in components/ui + become-seller/shared
 * are dark-themed (white text on translucent-black glass). This redesigned
 * seller application lives in a single LIGHT visual world, so it needs its own
 * light-on-ivory field set styled straight from the PALETTE. These primitives
 * are self-contained and shared across the redesign's step screens.
 */
export { default as FieldShell } from './FieldShell'
export { default as TextField } from './TextField'
export { default as LightCombobox } from './LightCombobox'
export { default as LightPhoneInput } from './LightPhoneInput'
export { inputBaseStyle, inputBaseClass } from './styles'
