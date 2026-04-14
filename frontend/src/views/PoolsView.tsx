import { useState } from 'react'
import { useDnsStore } from '../store/dnsStore'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { FormField, Input } from '../components/FormField'
import * as Backend from '../wailsjs/go/main/App'
import type { config } from '../wailsjs/models'

const emptyPool = (): config.PoolConfig => ({ name: '', members: [] })

export function PoolsView() {
  const { pools, setPools, upstreams } = useDnsStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editPool, setEditPool] = useState<config.PoolConfig | null>(null)

  async function reload() {
    const p = await Backend.GetPools()
    setPools(p || [])
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete pool "${name}"?`)) return
    await Backend.DeletePool(name)
    await reload()
  }

  const upstreamNames = upstreams.map((u) => u.name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Pools</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Group upstreams together for load balancing or failover
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditPool(null); setShowAdd(true) }}>
          + Add Pool
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <div className="text-sm">No pools configured</div>
            <Button size="sm" onClick={() => setShowAdd(true)}>Create your first pool</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <PoolCard
                key={pool.name}
                pool={pool}
                onEdit={() => { setEditPool(pool); setShowAdd(true) }}
                onDelete={() => handleDelete(pool.name)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <PoolModal
          initial={editPool || emptyPool()}
          isEdit={editPool !== null}
          upstreamNames={upstreamNames}
          onClose={() => setShowAdd(false)}
          onSave={async () => { await reload(); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

function PoolCard({
  pool,
  onEdit,
  onDelete,
}: {
  pool: config.PoolConfig
  onEdit: () => void
  onDelete: () => void
}) {
  const shown = pool.members.slice(0, 3)
  const extra = pool.members.length - shown.length

  return (
    <div className="group bg-bg-card border border-white/5 rounded-card p-4 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-sm text-white">{pool.name}</div>
          <div className="text-xs text-white/40 mt-0.5">
            {pool.members.length} member{pool.members.length !== 1 ? 's' : ''}
          </div>
        </div>
        {/* Layered icon */}
        <div className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #5B6EF5, #8B5CF6)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
      </div>

      {/* Members preview */}
      <div className="flex flex-col gap-1">
        {shown.map((m) => (
          <div key={m} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/60 shrink-0" />
            <span className="text-xs text-white/50 truncate">{m}</span>
          </div>
        ))}
        {extra > 0 && (
          <div className="text-xs text-white/30 pl-3.5">+{extra} more</div>
        )}
        {pool.members.length === 0 && (
          <div className="text-xs text-white/30">No members</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

function PoolModal({
  initial,
  isEdit,
  upstreamNames,
  onClose,
  onSave,
}: {
  initial: config.PoolConfig
  isEdit: boolean
  upstreamNames: string[]
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [name, setName] = useState(initial.name)
  const [members, setMembers] = useState<Set<string>>(new Set(initial.members))
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  function toggleMember(m: string) {
    setMembers((prev) => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setNameError('Name is required'); return }
    setSaving(true)
    try {
      const pool: config.PoolConfig = {
        name: name.trim(),
        members: Array.from(members),
      }
      if (isEdit) {
        await Backend.UpdatePool(initial.name, pool)
      } else {
        await Backend.AddPool(pool)
      }
      await onSave()
    } catch (e: any) {
      setNameError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Pool' : 'Add Pool'}
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
        <FormField label="Pool Name">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
            placeholder="my-pool"
            error={nameError}
          />
        </FormField>

        <FormField label="Members" hint="Select which upstream servers belong to this pool">
          {upstreamNames.length === 0 ? (
            <p className="text-sm text-white/40">No upstreams configured yet.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {upstreamNames.map((n) => (
                <label
                  key={n}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-btn cursor-pointer hover:bg-white/5 transition-colors no-drag"
                >
                  <input
                    type="checkbox"
                    checked={members.has(n)}
                    onChange={() => toggleMember(n)}
                    className="accent-accent-blue"
                  />
                  <span className="text-sm text-white/80">{n}</span>
                </label>
              ))}
            </div>
          )}
        </FormField>
      </div>
    </Modal>
  )
}
