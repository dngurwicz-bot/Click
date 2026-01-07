import React from 'react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showSubtext?: boolean
  className?: string
}

export default function Logo({ size = 'md', showSubtext = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  }

  const subtextSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm'
  }

  return (
    <div 
      className={`flex items-center justify-center cursor-pointer gap-2.5 ${className}`}
      style={{ 
        direction: 'ltr',
        fontFamily: "'Rubik', sans-serif"
      }}
    >
      <div 
        className={`font-black ${sizeClasses[size]}`}
        style={{ 
          color: '#2C3E50',
          letterSpacing: '-1px'
        }}
      >
        CLICK<span style={{ color: '#00A896' }}>.</span>
      </div>
      
      <div 
        className="w-px"
        style={{ 
          height: '20px', 
          backgroundColor: '#BDC3C7' 
        }}
      />
      
      {showSubtext && (
        <div 
          className={`font-medium ${subtextSize[size]}`}
          style={{ 
            color: '#7F8C8D',
            lineHeight: '1.2'
          }}
        >
          DNG<br />HUB
        </div>
      )}
    </div>
  )
}