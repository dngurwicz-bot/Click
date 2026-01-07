import React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default'
  children: React.ReactNode
}

export default function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700',
    success: 'badge-success',
    error: 'badge-error',
    warning: 'badge-warning',
    info: 'badge-info',
  }

  return (
    <span
      className={cn('badge', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </span>
  )
}
