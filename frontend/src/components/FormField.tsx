import React from 'react'

interface FormFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export function Input({ className = '', error, ...props }: InputProps) {
  return (
    <>
      <input
        className={`w-full bg-bg-primary border ${error ? 'border-error-red/50' : 'border-white/10'} rounded-btn px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-blue/50 transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-error-red">{error}</p>}
    </>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full bg-bg-primary border border-white/10 rounded-btn px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue/50 transition-colors appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${checked ? '' : 'bg-white/10'}`}
        style={checked ? { background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' } : {}}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </div>
      {label && <span className="text-sm text-white/80">{label}</span>}
    </label>
  )
}
