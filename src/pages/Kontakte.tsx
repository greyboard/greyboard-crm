import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Lead, LeadStatus } from '../types/lead'
import { LeadDetailModal } from '../components/LeadDetailModal'

// ── Typen ──────────────────────────────────────────────────────────────────────

type SortKey = 'company_name' | 'country' | 'industry' | 'status' | 'last_action_at'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Schweiz', LI: 'Liechtenstein', DE: 'Deutschland', AT: 'Österreich',
}

// ── Konstanten ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: LeadStatus[] = ['Neu', 'Validiert', 'Kontaktiert', 'Kontaktversuch', 'Antwort erhalten', 'Nicht interessiert', 'Nicht geeignet']

const statusCfg: Record<LeadStatus, string> = {
  Neu:                  'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600/50',
  Validiert:            'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30',
  Kontaktiert:          'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600/50',
  Kontaktversuch:       'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30',
  'Antwort erhalten':   'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30',
  'Nicht interessiert': 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30',
  'Nicht geeignet':     'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '–'
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)        return 'Gerade eben'
  if (diff < 3600)      return `Vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400)     return `Vor ${Math.floor(diff / 3600)} Std.`
  if (diff < 86400 * 2) return 'Gestern'
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Sortier-Header ─────────────────────────────────────────────────────────────

function ThSort({ label, col, sort, onSort }: {
  label: string; col: SortKey
  sort: { key: SortKey; dir: SortDir }; onSort: (col: SortKey) => void
}) {
  const active = sort.key === col
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <Icon size={12} className={active ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-600'} />
      </span>
    </th>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────────────────────

export function Kontakte() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(0)
  const [query, setQuery]           = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filterStatus, setFilterStatus]     = useState<LeadStatus | ''>('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterCountry, setFilterCountry]   = useState('')
  const [industries, setIndustries] = useState<string[]>([])
  const [countries, setCountries]   = useState<string[]>([])
  const [sort, setSort]             = useState<{ key: SortKey; dir: SortDir }>({ key: 'last_action_at', dir: 'desc' })
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Debounce Suche
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Seite bei Filter-/Sort-Änderung zurücksetzen
  useEffect(() => { setPage(0) }, [debouncedQuery, filterStatus, filterIndustry, filterCountry, sort])

  // Dropdown-Optionen einmalig laden
  useEffect(() => {
    supabase.from('leads').select('country, industry').then(({ data }) => {
      if (!data) return
      setIndustries([...new Set(data.map((r: any) => r.industry).filter(Boolean))].sort() as string[])
      setCountries([...new Set(data.map((r: any) => r.country).filter(Boolean))].sort() as string[])
    })
  }, [])

  const fetchLeads = useCallback(async () => {
    setLoading(true)

    let q = supabase.from('leads').select('*', { count: 'exact' })
      .order(sort.key, { ascending: sort.dir === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterStatus)   q = q.eq('status', filterStatus)
    if (filterIndustry) q = q.eq('industry', filterIndustry)
    if (filterCountry)  q = q.eq('country', filterCountry)
    if (debouncedQuery) {
      q = q.or(
        `company_name.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%,website.ilike.%${debouncedQuery}%`
      )
    }

    const { data, count } = await q
    setLeads((data as Lead[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, sort, debouncedQuery, filterStatus, filterIndustry, filterCountry])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function toggleSort(col: SortKey) {
    setSort(prev =>
      prev.key === col
        ? { key: col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col, dir: 'asc' }
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const from = page * PAGE_SIZE + 1
  const to   = Math.min((page + 1) * PAGE_SIZE, total)

  const selectCls = 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer'

  return (
    <div className="flex flex-col gap-5">

      {/* Kopfzeile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Kontakte</h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
            {loading ? '…' : `${total.toLocaleString('de-DE')} Kontakte`}
          </p>
        </div>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Filter-Zeile */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Suche nach Firma, Name, E-Mail…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any) }} className={selectCls}>
          <option value="">Alle Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} className={selectCls}>
          <option value="">Alle Branchen</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className={selectCls}>
          <option value="">Alle Länder</option>
          {countries.map(c => <option key={c} value={c}>{COUNTRY_NAMES[c] ?? c}</option>)}
        </select>
      </div>

      {/* Tabelle */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <ThSort label="Firma"              col="company_name"   sort={sort} onSort={toggleSort} />
                <ThSort label="Land"               col="country"        sort={sort} onSort={toggleSort} />
                <ThSort label="Branche"            col="industry"       sort={sort} onSort={toggleSort} />
                <ThSort label="Status"             col="status"         sort={sort} onSort={toggleSort} />
                <ThSort label="Letzte Interaktion" col="last_action_at" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 text-sm">
                    Lade Kontakte…
                  </td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 text-sm">
                    Keine Kontakte gefunden.
                  </td>
                </tr>
              )}
              {!loading && leads.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[220px]">
                      {lead.company_name}
                    </p>
                    {lead.full_name && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[220px]">{lead.full_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {lead.country
                        ? lead.state ? `${lead.country} / ${lead.state}` : lead.country
                        : '–'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {lead.industry || '–'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const d = lead.ghl_date_updated ?? lead.ghl_date_added ?? lead.last_action_at
                      return (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400" title={fmtDateTime(d)}>
                          {fmtDate(d)}
                        </span>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer mit Paginierung */}
        {!loading && total > 0 && (
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              {from}–{to} von {total.toLocaleString('de-DE')} Kontakten
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs text-zinc-400 px-2">
                Seite {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={updated => {
          setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
          setSelectedLead(updated)
        }}
      />
    </div>
  )
}
