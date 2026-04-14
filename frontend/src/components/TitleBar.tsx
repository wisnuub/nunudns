import { WindowMinimise, WindowToggleMaximise, WindowClose } from '../wailsjs/runtime/runtime'
import { useDnsStore } from '../store/dnsStore'

export function TitleBar() {
  const running = useDnsStore((s) => s.running)

  return (
    <div
      className="drag-region flex items-center justify-between h-10 px-4 shrink-0"
      style={{ background: '#0A0C10', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Left spacer (mirrors controls width) */}
      <div className="w-20" />

      {/* Center: app name + status dot */}
      <div className="flex items-center gap-2">
        {/* DNS Shield icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="tb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5B6EF5" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <path
            d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z"
            fill="url(#tb-grad)"
          />
        </svg>
        <span className="text-sm font-semibold gradient-text tracking-wide">NunuDNS</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-success animate-pulse-dot' : 'bg-white/30'}`}
        />
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center gap-1 w-20 justify-end">
        <button
          onClick={WindowMinimise}
          className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect y="5.5" width="12" height="1" rx="0.5" />
          </svg>
        </button>
        <button
          onClick={WindowToggleMaximise}
          className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          title="Maximize"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="0.6" y="0.6" width="9.8" height="9.8" rx="1.4" />
          </svg>
        </button>
        <button
          onClick={WindowClose}
          className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-red-500/80 transition-colors"
          title="Close"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M1 1l9 9M10 1L1 10" />
          </svg>
        </button>
      </div>
    </div>
  )
}
