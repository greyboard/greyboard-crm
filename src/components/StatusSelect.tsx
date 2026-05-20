import { useState, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { LeadStatus } from '../types/lead'

export const STATUS_ORDER: LeadStatus[] = [
  'Neu',
  'Validiert',
  'Kontaktversuch',
  'Kontaktiert',
  'Antwort erhalten',
  'Nicht interessiert',
  'Nicht geeignet',
]

export const statusCfg: Record<LeadStatus, { badge: string; dot: string }> = {
  'Neu':                  { badge: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600/50',                dot: 'bg-zinc-400' },
  'Validiert':            { badge: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30',                       dot: 'bg-sky-500' },
  'Kontaktversuch':       { badge: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30',     dot: 'bg-orange-500' },
  'Kontaktiert':          { badge: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30',     dot: 'bg-indigo-500' },
  'Antwort erhalten':     { badge: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
  'Nicht interessiert':   { badge: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30',                       dot: 'bg-red-500' },
  'Nicht geeignet':       { badge: 'bg-zinc-200 dark:bg-zinc-600/30 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600/50',               dot: 'bg-zinc-400 dark:bg-zinc-500' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = statusCfg[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  )
}

interface StatusSelectProps {
  value: LeadStatus
  onChange: (s: LeadStatus) => void
  nullable?: boolean
  nullLabel?: string
  className?: string
}

export function StatusSelect({ value, onChange, nullable, nullLabel = 'Alle Status', className = '' }: StatusSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const cfg = statusCfg[value]

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none ${
          cfg
            ? `${cfg.badge} pr-2`
            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
        }`}
      >
        {cfg && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />}
        <span>{cfg ? value : nullLabel}</span>
        <ChevronDown size={13} className="opacity-50 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl py-1 min-w-[200px]">
            {nullable && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange('' as LeadStatus); setOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {nullLabel}
                {!value && <Check size={13} className="text-emerald-500" />}
              </button>
            )}
            {nullable && <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />}
            {STATUS_ORDER.map(s => {
              const c = statusCfg[s]
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(s); setOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                    {s}
                  </span>
                  {value === s && <Check size={13} className="text-emerald-500 shrink-0 ml-2" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
