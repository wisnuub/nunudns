import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  color?: 'blue' | 'purple' | 'green' | 'red' | 'yellow' | 'gray'
  className?: string
}

const colorMap = {
  blue:   'bg-accent-blue/20 text-accent-blue border-accent-blue/30',
  purple: 'bg-accent-purple/20 text-accent-purple border-accent-purple/30',
  green:  'bg-success/20 text-success border-success/30',
  red:    'bg-error-red/20 text-error-red border-error-red/30',
  yellow: 'bg-warning/20 text-warning border-warning/30',
  gray:   'bg-white/10 text-white/60 border-white/10',
}

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[color]} ${className}`}>
      {children}
    </span>
  )
}
