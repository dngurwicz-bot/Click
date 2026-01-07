import React from 'react'
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: LucideIcon
}

export default function Input({
  label,
  error,
  helperText,
  className,
  id,
  icon: Icon,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id || generatedId

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
      <div className="relative">
        {Icon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Icon size={18} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'input',
            Icon && 'pr-10',
            error && 'border-error focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        />
      </div>
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
