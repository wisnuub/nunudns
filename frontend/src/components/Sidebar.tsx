import { useState } from 'react'
import { useDnsStore, type View } from '../store/dnsStore'

interface NavItem {
  id: View
  label: string
  icon: React.ReactNode
}

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function ServersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function RulesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function ProcessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PoolsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

const navItems: NavItem[] = [
  { id: 'log',       label: 'Activity Log',  icon: <ActivityIcon /> },
  { id: 'servers',   label: 'DNS Servers',   icon: <ServersIcon /> },
  { id: 'rules',     label: 'Rules',         icon: <RulesIcon /> },
  { id: 'processes', label: 'App Rules',     icon: <ProcessIcon /> },
  { id: 'pools',     label: 'Pools',         icon: <PoolsIcon /> },
  { id: 'settings',  label: 'Settings',      icon: <SettingsIcon /> },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const { activeView, setActiveView, running } = useDnsStore()

  return (
    <div
      className="relative flex flex-col h-full shrink-0 transition-all duration-300 overflow-hidden"
      style={{
        width: expanded ? 220 : 72,
        background: '#0A0C10',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 mb-2 h-14 shrink-0">
        <div
          className="w-9 h-9 rounded-card flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" />
          </svg>
        </div>
        <span
          className="text-sm font-bold gradient-text whitespace-nowrap overflow-hidden transition-all duration-300"
          style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 120 : 0 }}
        >
          NunuDNS
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className="relative flex items-center gap-3 h-11 rounded-card transition-all duration-150 no-drag group"
              style={{
                paddingLeft: expanded ? 12 : 0,
                justifyContent: expanded ? 'flex-start' : 'center',
                background: isActive ? 'rgba(91,110,245,0.12)' : 'transparent',
              }}
              title={!expanded ? item.label : undefined}
            >
              {/* Active left border indicator */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                  style={{
                    height: 24,
                    background: 'linear-gradient(180deg, #5B6EF5, #8B5CF6)',
                  }}
                />
              )}

              {/* Icon container */}
              <div
                className="flex items-center justify-center w-8 h-8 rounded-btn transition-colors shrink-0"
                style={
                  isActive
                    ? { background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)', color: 'white' }
                    : { color: 'rgba(255,255,255,0.4)' }
                }
              >
                {item.icon}
              </div>

              {/* Label */}
              <span
                className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                style={{
                  color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
                  opacity: expanded ? 1 : 0,
                  maxWidth: expanded ? 140 : 0,
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Bottom status */}
      <div
        className="flex items-center gap-2.5 px-4 py-4 shrink-0 border-t border-white/5"
        style={{ minHeight: 56 }}
      >
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-success animate-pulse-dot' : 'bg-white/20'}`}
        />
        <span
          className="text-xs whitespace-nowrap overflow-hidden transition-all duration-300"
          style={{
            color: running ? '#16A34A' : 'rgba(255,255,255,0.4)',
            opacity: expanded ? 1 : 0,
            maxWidth: expanded ? 160 : 0,
          }}
        >
          {running ? 'Running' : 'Stopped'}
        </span>
      </div>
    </div>
  )
}
