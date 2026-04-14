import { useState, useEffect } from 'react'
import { useDnsStore } from '../store/dnsStore'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { FormField, Input, Select } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config } from '../wailsjs/models'

const emptyRule = (): config.ProcessRule => ({
  process: '',
  match: '',
  upstream: '',
  enabled: true,
})

// Well-known process names for quick-pick suggestions
const KNOWN_APPS = [
  { name: 'Chrome', exe: 'chrome.exe' },
  { name: 'Firefox', exe: 'firefox.exe' },
  { name: 'Edge', exe: 'msedge.exe' },
  { name: 'League of Legends', exe: 'LeagueClient.exe' },
  { name: 'Valorant', exe: 'VALORANT-Win64-Shipping.exe' },
  { name: 'Steam', exe: 'steam.exe' },
  { name: 'Discord', exe: 'Discord.exe' },
  { name: 'Spotify', exe: 'Spotify.exe' },
  { name: 'Battle.net', exe: 'Battle.net.exe' },
  { name: 'Epic Games', exe: 'EpicGamesLauncher.exe' },
  { name: 'Minecraft', exe: 'javaw.exe' },
]

export function ProcessesView() {
  const { processRules, setProcessRules, processStats, upstreams } = useDnsStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  async function reload() {
    const r = await Backend.GetProcessRules()
    setProcessRules(r || [])
  }

  async function handleDelete(i: number) {
    if (!confirm(`Delete rule for "${processRules[i].process}"?`)) return
    await Backend.DeleteProcessRule(i)
    await reload()
  }

  async function handleToggle(i: number) {
    const rule = { ...processRules[i], enabled: !processRules[i].enabled }
    await Backend.UpdateProcessRule(i, rule)
    await reload()
  }

  const upstreamNames = upstreams.map((u) => u.name)
  const seenProcesses = Array.from(processStats.values())
    .sort((a, b) => b.queryCount - a.queryCount)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">App Rules</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Route DNS queries differently per application — e.g. League → Google, Chrome → AdGuard
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditIndex(null); setShowAdd(true) }}>
          + Add App Rule
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {/* Active rules */}
        <div>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Configured Rules
          </div>
          {processRules.length === 0 ? (
            <div className="bg-bg-card border border-white/5 rounded-card p-8 flex flex-col items-center gap-4 text-white/30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className="text-center">
                <div className="text-sm mb-1">No app rules yet</div>
                <div className="text-xs">Add a rule to route League of Legends through Google DNS, Chrome through AdGuard, etc.</div>
              </div>
              <Button size="sm" onClick={() => setShowAdd(true)}>Add your first rule</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {processRules.map((rule, i) => (
                <ProcessRuleCard
                  key={i}
                  rule={rule}
                  onEdit={() => { setEditIndex(i); setShowAdd(true) }}
                  onDelete={() => handleDelete(i)}
                  onToggle={() => handleToggle(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Active processes seen making DNS queries */}
        {seenProcesses.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Active Applications
              <span className="ml-2 text-white/20 normal-case font-normal">seen making DNS queries this session</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {seenProcesses.map((stat) => {
                const hasRule = processRules.some(
                  (r) => r.process.toLowerCase() === stat.name.toLowerCase()
                )
                return (
                  <div
                    key={stat.name}
                    className="group flex items-center gap-4 bg-bg-card border border-white/5 rounded-card px-4 py-3 hover:border-white/10 transition-colors"
                  >
                    {/* Process icon placeholder */}
                    <div className="w-8 h-8 rounded-btn flex items-center justify-center shrink-0 bg-white/5 text-white/40">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{stat.name}</div>
                      <div className="text-xs text-white/40">
                        {stat.queryCount} quer{stat.queryCount === 1 ? 'y' : 'ies'}
                        {stat.upstreams.size > 0 && (
                          <span className="ml-2">via {Array.from(stat.upstreams).join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {hasRule ? (
                      <Badge color="blue">Rule active</Badge>
                    ) : (
                      <button
                        onClick={() => {
                          setEditIndex(null)
                          setShowAdd(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded transition-all"
                      >
                        Add rule
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick-add well-known apps */}
        <div>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Quick Add
          </div>
          <div className="flex flex-wrap gap-2">
            {KNOWN_APPS.map((app) => {
              const hasRule = processRules.some(
                (r) => r.process.toLowerCase() === app.exe.toLowerCase()
              )
              return (
                <button
                  key={app.exe}
                  disabled={hasRule}
                  onClick={() => {
                    setEditIndex(null)
                    setShowAdd(true)
                    // We'll pass the preset via state below
                  }}
                  className={`px-3 py-1.5 text-xs rounded-btn border transition-colors ${
                    hasRule
                      ? 'border-accent-blue/30 text-accent-blue/60 cursor-default'
                      : 'border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  {hasRule ? '✓ ' : ''}{app.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showAdd && (
        <ProcessRuleModal
          initial={editIndex !== null ? processRules[editIndex] : emptyRule()}
          editIndex={editIndex}
          upstreamNames={upstreamNames}
          onClose={() => setShowAdd(false)}
          onSave={async () => { await reload(); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

function ProcessRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: config.ProcessRule
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const isBlock = rule.upstream === '__block__'

  return (
    <div
      className={`group flex items-center gap-3 bg-bg-card border rounded-card px-4 py-3 transition-colors ${
        rule.enabled ? 'border-white/5 hover:border-white/10' : 'border-white/[0.03] opacity-50'
      }`}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className="w-8 h-8 flex items-center justify-center rounded-btn shrink-0 transition-colors hover:bg-white/5"
        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
      >
        <div
          className="w-4 h-4 rounded-full border-2 transition-colors"
          style={rule.enabled
            ? { background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)', borderColor: 'transparent' }
            : { borderColor: 'rgba(255,255,255,0.2)' }
          }
        />
      </button>

      {/* Process */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-sm text-white font-medium shrink-0">{rule.process}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30 shrink-0">
          <path d="M2 6h8M7 3l3 3-3 3" />
        </svg>
        <span className="text-xs text-white/50 truncate">
          {rule.match ? rule.match : 'all domains'}
        </span>
      </div>

      {/* Action */}
      <Badge color={isBlock ? 'red' : 'blue'}>
        {isBlock ? 'BLOCK' : rule.upstream}
      </Badge>

      {/* Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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

function ProcessRuleModal({
  initial,
  editIndex,
  upstreamNames,
  onClose,
  onSave,
}: {
  initial: config.ProcessRule
  editIndex: number | null
  upstreamNames: string[]
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [process, setProcess] = useState(initial.process)
  const [match, setMatch] = useState(initial.match)
  const [action, setAction] = useState<'route' | 'block'>(
    initial.upstream === '__block__' ? 'block' : 'route'
  )
  const [upstream, setUpstream] = useState(
    initial.upstream === '__block__' ? '' : initial.upstream
  )
  const [enabled, setEnabled] = useState(initial.enabled !== false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!process.trim()) errs.process = 'Process name is required'
    if (action === 'route' && !upstream) errs.upstream = 'Select an upstream'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const rule: config.ProcessRule = {
        process: process.trim(),
        match: match.trim(),
        upstream: action === 'block' ? '__block__' : upstream,
        enabled,
      }
      if (editIndex !== null) {
        await Backend.UpdateProcessRule(editIndex, rule)
      } else {
        await Backend.AddProcessRule(rule)
      }
      await onSave()
    } catch (e: any) {
      setErrors({ process: String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editIndex !== null ? 'Edit App Rule' : 'Add App Rule'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Quick-pick known apps */}
        <div>
          <div className="text-xs font-medium text-white/40 mb-2">Quick pick</div>
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_APPS.map((app) => (
              <button
                key={app.exe}
                type="button"
                onClick={() => { setProcess(app.exe); setErrors({}) }}
                className={`px-2.5 py-1 text-xs rounded-btn border transition-colors ${
                  process === app.exe
                    ? 'border-accent-blue/50 text-accent-blue bg-accent-blue/10'
                    : 'border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>

        <FormField
          label="Process Name"
          hint='Exact filename: "chrome.exe", wildcard: "game*.exe", or "*" for any app'
        >
          <Input
            value={process}
            onChange={(e) => { setProcess(e.target.value); setErrors({}) }}
            placeholder="chrome.exe"
            error={errors.process}
          />
        </FormField>

        <FormField
          label="Domain Filter"
          hint='Leave empty to match ALL domains, or use patterns like "*.riotgames.com"'
        >
          <Input
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            placeholder="(all domains)"
          />
        </FormField>

        <FormField label="Action">
          <div className="flex gap-4">
            {(['route', 'block'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer no-drag">
                <input
                  type="radio"
                  name="action"
                  value={opt}
                  checked={action === opt}
                  onChange={() => setAction(opt)}
                  className="accent-accent-blue"
                />
                <span className="text-sm text-white/80 capitalize">{opt}</span>
              </label>
            ))}
          </div>
        </FormField>

        {action === 'route' && (
          <FormField label="Use Upstream">
            <Select
              value={upstream}
              onChange={(e) => { setUpstream(e.target.value); setErrors({}) }}
            >
              <option value="">— Select upstream —</option>
              {upstreamNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            {errors.upstream && (
              <p className="mt-1 text-xs text-error-red">{errors.upstream}</p>
            )}
          </FormField>
        )}

        {/* Example callout */}
        {process && action === 'route' && upstream && (
          <div className="p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-btn text-xs text-white/60">
            DNS queries from <span className="text-white font-mono">{process}</span>
            {match ? <> to <span className="text-white font-mono">{match}</span></> : ' (all domains)'}
            {' '}→ <span className="text-accent-blue">{upstream}</span>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer no-drag">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-accent-blue"
          />
          <span className="text-sm text-white/80">Rule enabled</span>
        </label>
      </div>
    </Modal>
  )
}
