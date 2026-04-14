import { useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { LogView } from './views/LogView'
import { ServersView } from './views/ServersView'
import { RulesView } from './views/RulesView'
import { PoolsView } from './views/PoolsView'
import { SettingsView } from './views/SettingsView'
import { useDnsStore } from './store/dnsStore'
import { EventsOn } from './wailsjs/runtime/runtime'
import * as Backend from './wailsjs/go/main/App'

export default function App() {
  const { activeView, setStatus, setUpstreams, setRules, setPools, setDefaultUpstream, addEvent } = useDnsStore()

  useEffect(() => {
    // Load initial data from backend
    Promise.all([
      Backend.GetStatus(),
      Backend.GetUpstreams(),
      Backend.GetRules(),
      Backend.GetPools(),
      Backend.GetDefaultUpstream(),
      Backend.GetRecentEvents(),
    ])
      .then(([status, upstreams, rules, pools, def, events]) => {
        setStatus(status.running, status.address)
        setUpstreams(upstreams || [])
        setRules(rules || [])
        setPools(pools || [])
        setDefaultUpstream(def)
        ;(events || []).forEach(addEvent)
      })
      .catch(console.error)

    // Subscribe to real-time DNS query events
    const off = EventsOn('dns:event', (event) => addEvent(event))
    return () => off()
  }, [])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: '#0D0F14' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          {activeView === 'log'      && <LogView />}
          {activeView === 'servers'  && <ServersView />}
          {activeView === 'rules'    && <RulesView />}
          {activeView === 'pools'    && <PoolsView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
      </div>
    </div>
  )
}
