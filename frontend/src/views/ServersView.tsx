import { useState, useEffect } from 'react'
import { useDnsStore } from '../store/dnsStore'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { FormField, Input, Select } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config } from '../wailsjs/models'

type Protocol = 'udp' | 'tcp' | 'doh' | 'dot'

const protocolColor: Record<string, 'blue' | 'purple' | 'gray'> = {
  doh: 'blue',
  dot: 'purple',
  udp: 'gray',
  tcp: 'gray',
}

interface BuiltinServer {
  name: string
  protocol: string
  address: string
}

const emptyUpstream = (): config.UpstreamConfig => ({
  name: '',
  address: '',
  protocol: 'doh',
  timeout: 5,
})

export function ServersView() {
  const { upstreams, setUpstreams } = useDnsStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<config.UpstreamConfig | null>(null)

  async function reload() {
    const u = await Backend.GetUpstreams()
    setUpstreams(u || [])
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete upstream "${name}"?`)) return
    await Backend.DeleteUpstream(name)
    await reload()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <h1 className="text-base font-semibold text-white">DNS Servers</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            Import from Library
          </Button>
          <Button size="sm" onClick={() => { setEditTarget(null); setShowAdd(true) }}>
            + Add Server
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {upstreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
            </svg>
            <div className="text-sm">No servers configured</div>
            <Button size="sm" onClick={() => setShowAdd(true)}>Add your first server</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upstreams.map((u) => (
              <ServerCard
                key={u.name}
                upstream={u}
                onEdit={() => { setEditTarget(u); setShowAdd(true) }}
                onDelete={() => handleDelete(u.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <AddEditModal
          initial={editTarget || emptyUpstream()}
          oldName={editTarget?.name ?? null}
          onClose={() => setShowAdd(false)}
          onSave={async () => { await reload(); setShowAdd(false) }}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={async () => { await reload(); setShowImport(false) }}
        />
      )}
    </div>
  )
}

function ServerCard({
  upstream,
  onEdit,
  onDelete,
}: {
  upstream: config.UpstreamConfig
  onEdit: () => void
  onDelete: () => void
}) {
  const [rtt, setRtt] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleTest() {
    setChecking(true)
    const result = await Backend.CheckServer(upstream.protocol, upstream.address)
    setRtt(result.rtt)
    setChecking(false)
  }

  const color = protocolColor[upstream.protocol] ?? 'gray'

  return (
    <div className="group relative bg-bg-card border border-white/5 rounded-card p-4 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge color={color}>{upstream.protocol.toUpperCase()}</Badge>
            <span className="font-medium text-sm text-white truncate">{upstream.name}</span>
          </div>
          <span className="text-xs text-white/40 font-mono truncate">{upstream.address}</span>
        </div>

        {/* RTT indicator */}
        <div className="flex items-center gap-1 shrink-0">
          {rtt !== null && (
            <span className={`text-xs font-mono ${rtt < 0 ? 'text-error-red' : 'text-success'}`}>
              {rtt < 0 ? 'Err' : `${rtt}ms`}
            </span>
          )}
          <span
            className={`w-2 h-2 rounded-full ${rtt === null ? 'bg-white/20' : rtt < 0 ? 'bg-error-red' : 'bg-success'}`}
          />
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleTest}
          disabled={checking}
          className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded transition-colors"
        >
          {checking ? 'Testing…' : 'Test'}
        </button>
        <button
          onClick={onEdit}
          className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-xs bg-error-red/10 hover:bg-error-red/20 text-error-red rounded transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function AddEditModal({
  initial,
  oldName,
  onClose,
  onSave,
}: {
  initial: config.UpstreamConfig
  oldName: string | null
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [form, setForm] = useState<config.UpstreamConfig>(initial)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ rtt: number; error: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function update(field: keyof config.UpstreamConfig, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.address.trim()) errs.address = 'Address is required'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      if (oldName) {
        await Backend.UpdateUpstream(oldName, form)
      } else {
        await Backend.AddUpstream(form)
      }
      await onSave()
    } catch (e: any) {
      setErrors({ name: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    const r = await Backend.CheckServer(form.protocol, form.address)
    setTestResult(r)
    setTesting(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={oldName ? 'Edit Server' : 'Add Server'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Name" hint="A friendly display name">
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Cloudflare DoH" error={errors.name} />
        </FormField>

        <FormField label="Protocol">
          <Select value={form.protocol} onChange={(e) => update('protocol', e.target.value)}>
            <option value="doh">DoH (DNS over HTTPS)</option>
            <option value="dot">DoT (DNS over TLS)</option>
            <option value="udp">UDP (Plain DNS)</option>
            <option value="tcp">TCP (Plain DNS)</option>
          </Select>
        </FormField>

        <FormField label="Address" hint={form.protocol === 'doh' ? 'e.g. https://cloudflare-dns.com/dns-query' : 'e.g. 1.1.1.1:53'}>
          <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder={form.protocol === 'doh' ? 'https://…' : '1.1.1.1:53'} error={errors.address} />
        </FormField>

        <FormField label="Timeout (seconds)">
          <Input type="number" value={form.timeout} onChange={(e) => update('timeout', parseInt(e.target.value) || 5)} min={1} max={30} />
        </FormField>

        {/* Inline test */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing || !form.address}>
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          {testResult && (
            <span className={`text-sm ${testResult.rtt < 0 ? 'text-error-red' : 'text-success'}`}>
              {testResult.rtt < 0 ? `Failed: ${testResult.error}` : `${testResult.rtt}ms`}
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => Promise<void>
}) {
  const [servers, setServers] = useState<BuiltinServer[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<Record<number, { rtt: number; error: string }>>({})
  const [testing, setTesting] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    Backend.GetBuiltinServers().then((s) => setServers(s || []))
  }, [])

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function testAll() {
    setTesting(true)
    const entries = await Promise.all(
      servers.map((s, i) => Backend.CheckServer(s.protocol, s.address).then((r) => [i, r] as const))
    )
    const map: Record<number, { rtt: number; error: string }> = {}
    for (const [i, r] of entries) map[i] = r
    setResults(map)
    setTesting(false)
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    const toImport = Array.from(selected).map((i) => servers[i])
    await Backend.ImportServers(toImport)
    await onImported()
    setImporting(false)
  }

  const color = (p: string): 'blue' | 'purple' | 'gray' =>
    p === 'doh' ? 'blue' : p === 'dot' ? 'purple' : 'gray'

  return (
    <Modal
      open
      onClose={onClose}
      title="Import DNS Servers"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={testAll} disabled={testing}>{testing ? 'Testing…' : 'Test All'}</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? 'Importing…' : `Import ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </Button>
        </>
      }
    >
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-card">
            <tr className="border-b border-white/5">
              <th className="w-8 py-2 text-left" />
              <th className="py-2 text-left text-xs text-white/40 font-medium">Name</th>
              <th className="py-2 text-left text-xs text-white/40 font-medium">Protocol</th>
              <th className="py-2 text-left text-xs text-white/40 font-medium">Address</th>
              <th className="py-2 text-right text-xs text-white/40 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s, i) => {
              const r = results[i]
              return (
                <tr
                  key={i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => toggle(i)}
                >
                  <td className="py-2 pl-1">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="no-drag" />
                  </td>
                  <td className="py-2 font-medium text-white">{s.name}</td>
                  <td className="py-2"><Badge color={color(s.protocol)}>{s.protocol.toUpperCase()}</Badge></td>
                  <td className="py-2 font-mono text-xs text-white/50 truncate max-w-[200px]">{s.address}</td>
                  <td className="py-2 text-right text-xs font-mono">
                    {r ? (
                      <span className={r.rtt < 0 ? 'text-error-red' : 'text-success'}>
                        {r.rtt < 0 ? 'Err' : `${r.rtt}ms`}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
