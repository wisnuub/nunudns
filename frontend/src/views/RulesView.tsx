import { useState } from 'react'
import { useDnsStore } from '../store/dnsStore'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { FormField, Input, Select } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config } from '../wailsjs/models'

const emptyRule = (): config.RouteRule => ({ match: '', upstream: '' })

export function RulesView() {
  const { rules, setRules, upstreams, defaultUpstream, setDefaultUpstream } = useDnsStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  async function reload() {
    const r = await Backend.GetRules()
    setRules(r || [])
  }

  async function handleDelete(i: number) {
    if (!confirm(`Delete rule "${rules[i].match}"?`)) return
    await Backend.DeleteRule(i)
    await reload()
  }

  async function handleMoveUp(i: number) {
    await Backend.MoveRuleUp(i)
    await reload()
  }

  async function handleMoveDown(i: number) {
    await Backend.MoveRuleDown(i)
    await reload()
  }

  async function handleDefaultChange(name: string) {
    await Backend.SetDefaultUpstream(name)
    setDefaultUpstream(name)
  }

  const upstreamNames = upstreams.map((u) => u.name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <h1 className="text-base font-semibold text-white">Rules</h1>
        <Button size="sm" onClick={() => { setEditIndex(null); setShowAdd(true) }}>
          + Add Rule
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        {/* Default upstream card */}
        <div className="bg-bg-card border border-white/5 rounded-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white">Default Upstream</div>
            <div className="text-xs text-white/40 mt-0.5">
              Used when no rule matches the queried domain
            </div>
          </div>
          <Select
            value={defaultUpstream}
            onChange={(e) => handleDefaultChange(e.target.value)}
            className="w-52 shrink-0"
          >
            <option value="">— None —</option>
            {upstreamNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </div>

        {/* Rule list */}
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-white/30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <div className="text-sm">No rules configured</div>
            <Button size="sm" onClick={() => setShowAdd(true)}>Add your first rule</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule, i) => (
              <RuleCard
                key={i}
                index={i}
                rule={rule}
                isFirst={i === 0}
                isLast={i === rules.length - 1}
                onEdit={() => { setEditIndex(i); setShowAdd(true) }}
                onDelete={() => handleDelete(i)}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <RuleModal
          initial={editIndex !== null ? rules[editIndex] : emptyRule()}
          editIndex={editIndex}
          upstreamNames={upstreamNames}
          onClose={() => setShowAdd(false)}
          onSave={async () => { await reload(); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

function RuleCard({
  index,
  rule,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  index: number
  rule: config.RouteRule
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const isBlock = rule.upstream === '__block__' || rule.upstream === ''
  const actionColor = isBlock ? 'red' : 'green'
  const actionLabel = isBlock ? 'BLOCK' : 'ROUTE'

  return (
    <div className="group bg-bg-card border border-white/5 rounded-card px-4 py-3 flex items-center gap-3 hover:border-white/10 transition-colors">
      {/* Order number */}
      <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono text-white/30 shrink-0 bg-white/5">
        {index + 1}
      </div>

      {/* Match pattern */}
      <span className="font-mono text-sm text-white/80 flex-1 truncate" title={rule.match}>
        {rule.match}
      </span>

      {/* Action badge */}
      <Badge color={actionColor === 'red' ? 'red' : 'green'}>{actionLabel}</Badge>

      {/* Upstream name */}
      {!isBlock && (
        <span className="text-xs text-white/40 truncate max-w-[140px]">{rule.upstream}</span>
      )}

      {/* Controls — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <polyline points="2 8 6 4 10 8" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <polyline points="2 4 6 8 10 4" />
          </svg>
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

function RuleModal({
  initial,
  editIndex,
  upstreamNames,
  onClose,
  onSave,
}: {
  initial: config.RouteRule
  editIndex: number | null
  upstreamNames: string[]
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [match, setMatch] = useState(initial.match)
  const [action, setAction] = useState<'route' | 'block'>(
    initial.upstream === '__block__' || initial.upstream === '' ? 'block' : 'route'
  )
  const [upstream, setUpstream] = useState(
    initial.upstream === '__block__' ? '' : initial.upstream
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!match.trim()) errs.match = 'Pattern is required'
    if (action === 'route' && !upstream) errs.upstream = 'Select an upstream'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const rule: config.RouteRule = {
        match: match.trim(),
        upstream: action === 'block' ? '__block__' : upstream,
      }
      if (editIndex !== null) {
        await Backend.UpdateRule(editIndex, rule)
      } else {
        await Backend.AddRule(rule)
      }
      await onSave()
    } catch (e: any) {
      setErrors({ match: String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editIndex !== null ? 'Edit Rule' : 'Add Rule'}
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
        <FormField
          label="Match Pattern"
          hint="e.g. example.com · *.example.com · /regex/"
        >
          <Input
            value={match}
            onChange={(e) => { setMatch(e.target.value); setErrors({}) }}
            placeholder="*.example.com"
            error={errors.match}
          />
        </FormField>

        <FormField label="Action">
          <div className="flex gap-3">
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
          <FormField label="Upstream Server">
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
      </div>
    </Modal>
  )
}
