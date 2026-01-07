import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showSubtext?: boolean
  className?: string
}

export default function Logo({ size = 'md', showSubtext = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  }

  const subtextSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white brand-gradient"
          style={{ 
            boxShadow: '0 2px 8px rgba(0, 168, 150, 0.3)'
          }}
        >
          C
        </div>
        <span className={`font-bold ${sizeClasses[size]}`} style={{ color: 'var(--text-primary)' }}>
          Click HR
        </span>
      </div>
      {showSubtext && (
        <span className={`${subtextSize[size]} font-normal`} style={{ color: 'var(--text-secondary)' }}>
          ניהול משאבי אנוש
        </span>
      )}
    </div>
  )
}
