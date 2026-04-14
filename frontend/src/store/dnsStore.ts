import { create } from 'zustand'
import type { config, logstream } from '../wailsjs/models'

export type View = 'log' | 'servers' | 'rules' | 'pools' | 'settings'

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
  pools: config.PoolConfig[]
  setPools: (p: config.PoolConfig[]) => void
  events: logstream.Event[]
  addEvent: (e: logstream.Event) => void
  clearEvents: () => void
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

  pools: [],
  setPools: (pools) => set({ pools }),

  events: [],
  addEvent: (e) =>
    set((s) => ({
      events:
        s.events.length >= 500
          ? [...s.events.slice(1), e]
          : [...s.events, e],
    })),
  clearEvents: () => set({ events: [] }),

  defaultUpstream: '',
  setDefaultUpstream: (name) => set({ defaultUpstream: name }),
}))
