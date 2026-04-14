import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-btn transition-all duration-150 no-drag disabled:opacity-50 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  }

  const variants = {
    primary: 'text-white hover:opacity-90 active:opacity-80',
    secondary: 'bg-transparent border border-white/10 text-white/80 hover:bg-white/5 hover:text-white active:bg-white/10',
    ghost: 'bg-transparent text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10',
    danger: 'bg-error-red/10 border border-error-red/30 text-error-red hover:bg-error-red/20 active:bg-error-red/30',
  }

  const primaryStyle = variant === 'primary'
    ? { background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' }
    : {}

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={primaryStyle}
      {...props}
    >
      {children}
    </button>
  )
}
