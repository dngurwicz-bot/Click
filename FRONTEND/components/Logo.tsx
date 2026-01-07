import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showSubtext?: boolean
  className?: string
  variant?: 'default' | 'light'
}

export default function Logo({ size = 'md', showSubtext = true, className = '', variant = 'default' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    '2xl': 'text-6xl'
  }

  const subtextSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
    '2xl': 'text-xl'
  }

  const colors = {
    default: {
      text: '#2C3E50',
      dot: '#00A896',
      line: '#BDC3C7',
      subtext: '#7F8C8D'
    },
    light: {
      text: '#FFFFFF',
      dot: '#00A896', // Keep teal dot or make it white? Keeping teal for brand identity unless requested otherwise.
      line: 'rgba(255, 255, 255, 0.3)',
      subtext: 'rgba(255, 255, 255, 0.8)'
    }
  }

  const currentColors = colors[variant]

  return (
    <div
      className={`flex items-center justify-center cursor-pointer gap-2.5 ${className}`}
      style={{
        direction: 'ltr',
        fontFamily: "'Rubik', sans-serif"
      }}
    >
      <div
        className={`font-black ${sizeClasses[size] || sizeClasses.md}`}
        style={{
          color: currentColors.text,
          letterSpacing: '-1px'
        }}
      >
        CLICK<span style={{ color: currentColors.dot }}>.</span>
      </div>

      <div
        className="w-px"
        style={{
          height: size === '2xl' ? '40px' : '20px',
          backgroundColor: currentColors.line
        }}
      />

      {showSubtext && (
        <div
          className={`font-medium ${subtextSize[size] || subtextSize.md}`}
          style={{
            color: currentColors.subtext,
            lineHeight: '1.2'
          }}
        >
          DNG<br />HUB
        </div>
      )}
    </div>
  )
}