/**
 * TextField — a plain light input styled for the Forest Ledger world. Forwards
 * a ref so it drops straight into react-hook-form's `register()`. Invalid state
 * paints the border/ring forest-red.
 */

'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { inputBaseClass, inputBaseStyle } from './styles'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { invalid, className, style, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={
        inputBaseClass +
        (invalid
          ? ' !border-[#B4462F] focus:!ring-[#B4462F]/15'
          : '') +
        (className ? ` ${className}` : '')
      }
      style={{ ...inputBaseStyle, ...style }}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export default TextField
