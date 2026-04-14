import { useEffect, useRef, useState } from 'react'
import { useDnsStore } from '../store/dnsStore'
import { Button } from '../components/Button'
import * as Backend from '../wailsjs/go/main/App'
import type { logstream } from '../wailsjs/models'

function formatTime(t: string | Date): string {
  try {
    const d = typeof t === 'string' ? new Date(t) : t
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

function formatLatency(ns: number): string {
  if (!ns) return '—'
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(0)}µs`
  return `${(ns / 1_000_000).toFixed(1)}ms`
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; color: string }> = {
    RESOLVED: { label: 'RESOLVED', color: 'text-success bg-success/10' },
    BLOCKED:  { label: 'BLOCKED',  color: 'text-error-red bg-error-red/10' },
    CACHED:   { label: 'CACHED',   color: 'text-accent-blue bg-accent-blue/10' },
  }
  const entry = map[action] ?? { label: action, color: 'text-white/50 bg-white/5' }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${entry.color}`}>
      {entry.label}
    </span>
  )
}

export function LogView() {
  const { events, clearEvents, running, setStatus } = useDnsStore()
  const [filter, setFilter] = useState('')
  const [paused, setPaused] = useState(false)
  const [toggling, setToggling] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (paused) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events, paused])

  const filtered = filter
    ? events.filter((e) => e.Domain?.toLowerCase().includes(filter.toLowerCase()))
    : events

  async function handleToggle() {
    setToggling(true)
    try {
      if (running) {
        await Backend.StopDNS()
      } else {
        await Backend.StartDNS()
      }
      const status = await Backend.GetStatus()
      setStatus(status.running, status.address)
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-white">Activity Log</h1>
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              running
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-success animate-pulse-dot' : 'bg-white/30'}`} />
            {running ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3 2l7 4-7 4V2z" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2" y="2" width="3" height="8" rx="1" />
                  <rect x="7" y="2" width="3" height="8" rx="1" />
                </svg>
                Pause
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearEvents}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Clear
          </Button>
          <Button
            variant={running ? 'danger' : 'primary'}
            size="sm"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? 'Working…' : running ? 'Stop DNS' : 'Start DNS'}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-white/5 shrink-0">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by domain…"
          className="w-full max-w-sm bg-bg-card border border-white/10 rounded-btn px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-blue/50 transition-colors"
        />
      </div>

      {/* Table */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" />
            </svg>
            <div className="text-sm">No queries yet</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: '#0D0F14' }}>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40 w-24">Time</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">Domain</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40 w-16">Type</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40 w-28">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">Upstream</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-white/40 w-20">Latency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, i) => (
                <EventRow key={i} event={ev} />
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function EventRow({ event }: { event: logstream.Event }) {
  return (
    <tr className="border-b border-white/[0.03] hover:bg-bg-card transition-colors">
      <td className="px-4 py-2 text-xs text-white/40 font-mono whitespace-nowrap">
        {formatTime(event.Time)}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-white/80 max-w-xs truncate">
        {event.Domain}
      </td>
      <td className="px-4 py-2 text-xs text-white/50 font-mono">
        {event.QType}
      </td>
      <td className="px-4 py-2">
        <ActionBadge action={event.Action} />
      </td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[160px]">
        {event.Upstream || '—'}
      </td>
      <td className="px-4 py-2 text-right text-xs text-white/40 font-mono">
        {formatLatency(event.Latency)}
      </td>
    </tr>
  )
}
