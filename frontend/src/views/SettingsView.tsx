import { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { FormField, Input, Select } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config, netsetup } from '../wailsjs/models'

const defaultSettings: config.ServerConfig = {
  listen: '127.0.0.1:53',
  log_level: 'info',
  cache: true,
  cache_ttl: 300,
}

export function SettingsView() {
  const [settings, setSettings] = useState<config.ServerConfig>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [serviceStatus, setServiceStatus] = useState<string>('loading')
  const [serviceWorking, setServiceWorking] = useState(false)

  const [adapters, setAdapters] = useState<netsetup.AdapterInfo[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [systemDnsActive, setSystemDnsActive] = useState(false)
  const [netWorking, setNetWorking] = useState(false)
  const [netError, setNetError] = useState('')

  useEffect(() => {
    Backend.GetSettings().then((s) => { if (s) setSettings(s) })
    Backend.GetServiceStatus().then(setServiceStatus)
    Backend.IsAdmin().then(setIsAdmin)
    Backend.GetAdapters().then((a) => {
      const list = a || []
      setAdapters(list)
      // Detect if system DNS is already pointed at 127.0.0.1
      const allRouted = list.length > 0 && list.every(
        (ad) => ad.current_dns?.includes('127.0.0.1')
      )
      setSystemDnsActive(allRouted)
    })
  }, [])

  async function refreshAdapters() {
    const list = await Backend.GetAdapters()
    setAdapters(list || [])
    const allRouted = (list || []).length > 0 && (list || []).every(
      (ad) => ad.current_dns?.includes('127.0.0.1')
    )
    setSystemDnsActive(allRouted)
  }

  async function handleEnableSystemDNS() {
    setNetWorking(true)
    setNetError('')
    try {
      await Backend.EnableSystemDNS()
      await refreshAdapters()
      setSystemDnsActive(true)
    } catch (e: any) {
      setNetError(String(e))
    } finally {
      setNetWorking(false)
    }
  }

  async function handleDisableSystemDNS() {
    setNetWorking(true)
    setNetError('')
    try {
      await Backend.DisableSystemDNS()
      await refreshAdapters()
      setSystemDnsActive(false)
    } catch (e: any) {
      setNetError(String(e))
    } finally {
      setNetWorking(false)
    }
  }

  function update<K extends keyof config.ServerConfig>(key: K, value: config.ServerConfig[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setSaved(false)
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await Backend.SaveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleService(action: 'install' | 'uninstall' | 'start' | 'stop') {
    setServiceWorking(true)
    try {
      if (action === 'install')   await Backend.InstallService()
      if (action === 'uninstall') await Backend.UninstallService()
      if (action === 'start')     await Backend.StartService()
      if (action === 'stop')      await Backend.StopService()
      const s = await Backend.GetServiceStatus()
      setServiceStatus(s)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setServiceWorking(false)
    }
  }

  const serviceLabel: Record<string, { text: string; color: string }> = {
    running:       { text: 'Running',       color: 'text-success' },
    stopped:       { text: 'Stopped',       color: 'text-warning' },
    not_installed: { text: 'Not Installed', color: 'text-white/40' },
    unsupported:   { text: 'Not supported on this platform', color: 'text-white/30' },
    loading:       { text: 'Loading…',      color: 'text-white/30' },
  }

  const svc = serviceLabel[serviceStatus] ?? { text: serviceStatus, color: 'text-white/40' }
  const isSupported = serviceStatus !== 'unsupported'
  const isInstalled = serviceStatus === 'running' || serviceStatus === 'stopped'

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <h1 className="text-base font-semibold text-white">Settings</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">
        {/* DNS Server settings */}
        <div className="bg-bg-card border border-white/5 rounded-card p-5 flex flex-col gap-4">
          <div className="text-sm font-semibold text-white">DNS Server</div>

          <FormField label="Listen Address" hint="IP:port to bind the DNS server on">
            <Input
              value={settings.listen}
              onChange={(e) => update('listen', e.target.value)}
              placeholder="127.0.0.1:53"
            />
          </FormField>

          <FormField label="Log Level">
            <Select
              value={settings.log_level}
              onChange={(e) => update('log_level', e.target.value)}
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </Select>
          </FormField>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-4 cursor-pointer no-drag">
              <div>
                <div className="text-sm text-white/80">Response Cache</div>
                <div className="text-xs text-white/40">Cache resolved answers to speed up repeated queries</div>
              </div>
              <button
                role="switch"
                aria-checked={settings.cache}
                onClick={() => update('cache', !settings.cache)}
                className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 no-drag"
                style={{ background: settings.cache ? 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: settings.cache ? 'translateX(20px)' : 'translateX(2px)' }}
                />
              </button>
            </label>

            {settings.cache && (
              <FormField label="Cache TTL (seconds)" hint="Maximum time responses are cached">
                <Input
                  type="number"
                  value={settings.cache_ttl}
                  onChange={(e) => update('cache_ttl', parseInt(e.target.value) || 300)}
                  min={10}
                  max={86400}
                />
              </FormField>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Apply Settings'}
            </Button>
            {error && <span className="text-xs text-error-red">{error}</span>}
          </div>
        </div>

        {/* Network / System DNS */}
        <div className="bg-bg-card border border-white/5 rounded-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">System DNS</div>
              <p className="text-xs text-white/40 mt-0.5">
                Set NunuDNS as the DNS server for all network adapters so every app is covered automatically
              </p>
            </div>
            <Badge color={systemDnsActive ? 'green' : 'gray'}>
              {systemDnsActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-btn text-xs text-warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Run NunuDNS as Administrator to change network adapter DNS settings
            </div>
          )}

          {/* Adapter list */}
          {adapters.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {adapters.map((ad) => {
                const isRouted = ad.current_dns?.includes('127.0.0.1')
                return (
                  <div key={ad.name} className="flex items-center justify-between text-sm px-3 py-2 bg-bg-primary/50 rounded-btn">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isRouted ? 'bg-success' : 'bg-white/20'}`} />
                      <span className="text-white/80">{ad.name}</span>
                    </div>
                    <span className="text-xs font-mono text-white/40">
                      {ad.current_dns?.length ? ad.current_dns.join(', ') : 'DHCP'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {!systemDnsActive ? (
              <Button
                onClick={handleEnableSystemDNS}
                disabled={netWorking || !isAdmin}
                size="sm"
              >
                {netWorking ? 'Applying…' : 'Enable System DNS'}
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={handleDisableSystemDNS}
                disabled={netWorking || !isAdmin}
                size="sm"
              >
                {netWorking ? 'Restoring…' : 'Disable System DNS'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={refreshAdapters}>
              Refresh
            </Button>
            {netError && <span className="text-xs text-error-red">{netError}</span>}
          </div>
        </div>

        {/* Windows Service */}
        <div className="bg-bg-card border border-white/5 rounded-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Windows Service</div>
            <span className={`text-xs font-medium ${svc.color}`}>{svc.text}</span>
          </div>

          {isSupported ? (
            <>
              <p className="text-xs text-white/40 -mt-1">
                Run NunuDNS as a Windows service so it starts automatically with your system.
                Requires administrator privileges.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {!isInstalled ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleService('install')}
                    disabled={serviceWorking}
                  >
                    Install Service
                  </Button>
                ) : (
                  <>
                    {serviceStatus === 'stopped' && (
                      <Button
                        size="sm"
                        onClick={() => handleService('start')}
                        disabled={serviceWorking}
                      >
                        Start Service
                      </Button>
                    )}
                    {serviceStatus === 'running' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleService('stop')}
                        disabled={serviceWorking}
                      >
                        Stop Service
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleService('uninstall')}
                      disabled={serviceWorking}
                    >
                      Uninstall Service
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-white/40">
              Windows service management is only available when running on Windows.
            </p>
          )}
        </div>

        {/* About */}
        <div className="bg-bg-card border border-white/5 rounded-card p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">NunuDNS</div>
            <div className="text-xs text-white/40 mt-0.5">Version 1.0.0</div>
          </div>
          <div
            className="w-9 h-9 rounded-card flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
