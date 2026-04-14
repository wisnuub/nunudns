import { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { FormField, Input, Select } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config } from '../wailsjs/models'

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

  useEffect(() => {
    Backend.GetSettings().then((s) => {
      if (s) setSettings(s)
    })
    Backend.GetServiceStatus().then(setServiceStatus)
  }, [])

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
