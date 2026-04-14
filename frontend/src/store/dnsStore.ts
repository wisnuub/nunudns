import { create } from 'zustand'
import type { config, logstream } from '../wailsjs/models'

export type View = 'log' | 'servers' | 'rules' | 'processes' | 'pools' | 'settings'

// ProcessStat tracks activity per process
export interface ProcessStat {
  name: string
  queryCount: number
  lastSeen: string
  upstreams: Set<string>
}

interface DnsStore {
  activeView: View
  setActiveView: (v: View) => void

  running: boolean
  address: string
  setStatus: (running: boolean, address: string) => void

  upstreams: config.UpstreamConfig[]
  setUpstreams: (u: config.UpstreamConfig[]) => void

  rules: config.RouteRule[]
  setRules: (r: config.RouteRule[]) => void

  processRules: config.ProcessRule[]
  setProcessRules: (r: config.ProcessRule[]) => void

  pools: config.PoolConfig[]
  setPools: (p: config.PoolConfig[]) => void

  events: logstream.Event[]
  addEvent: (e: logstream.Event) => void
  clearEvents: () => void

  // Per-process statistics derived from events
  processStats: Map<string, ProcessStat>

  defaultUpstream: string
  setDefaultUpstream: (name: string) => void
}

export const useDnsStore = create<DnsStore>((set) => ({
  activeView: 'log',
  setActiveView: (v) => set({ activeView: v }),

  running: false,
  address: '',
  setStatus: (running, address) => set({ running, address }),

  upstreams: [],
  setUpstreams: (upstreams) => set({ upstreams }),

  rules: [],
  setRules: (rules) => set({ rules }),

  processRules: [],
  setProcessRules: (processRules) => set({ processRules }),

  pools: [],
  setPools: (pools) => set({ pools }),

  events: [],
  addEvent: (e) =>
    set((s) => {
      const events =
        s.events.length >= 500
          ? [...s.events.slice(1), e]
          : [...s.events, e]

      // Update per-process stats
      const processStats = new Map(s.processStats)
      if (e.Process) {
        const existing = processStats.get(e.Process)
        if (existing) {
          existing.queryCount++
          existing.lastSeen = e.Time
          if (e.Upstream) existing.upstreams.add(e.Upstream)
        } else {
          processStats.set(e.Process, {
            name: e.Process,
            queryCount: 1,
            lastSeen: e.Time,
            upstreams: new Set(e.Upstream ? [e.Upstream] : []),
          })
        }
      }

      return { events, processStats }
    }),
  clearEvents: () => set({ events: [], processStats: new Map() }),

  processStats: new Map(),

  defaultUpstream: '',
  setDefaultUpstream: (name) => set({ defaultUpstream: name }),
}))
