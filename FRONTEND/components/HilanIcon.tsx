import React from 'react'

interface HilanIconProps {
    letter: string
    label: string
    variant?: 'yellow' | 'green'
    className?: string
}

export default function HilanIcon({ letter, label, variant = 'green', className = '' }: HilanIconProps) {
    const bgColors = {
        yellow: 'bg-[#F2A900]', // Approximated from screenshot (gold/yellow)
        green: 'bg-[#8BC34A]',  // Approximated from screenshot (light green)
    }

    return (
        <div className={`flex flex-col items-center gap-1 ${className}`}>
            {/* Teardrop Shape */}
            <div
                className={`${bgColors[variant]} w-10 h-10 flex items-center justify-center text-white font-bold text-lg shadow-sm`}
                style={{
                    borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)'
                }}
            >
                <span style={{ transform: 'rotate(45deg)' }}>{letter}</span>
            </div>

            {/* Label */}
            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                {label}
            </span>
        </div>
    )
}
