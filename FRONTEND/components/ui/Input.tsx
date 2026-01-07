import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export default function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'input',
          error && 'border-error focus:border-error focus:ring-error/20',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {helperText}
        </p>
      )}
    </div>
  )
}
