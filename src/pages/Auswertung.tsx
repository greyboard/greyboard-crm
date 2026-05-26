import { useState, useEffect, useMemo } from 'react'
import {
  Send, CheckCircle2, Eye, MousePointer2, XCircle,
  AlertTriangle, RefreshCw, TrendingUp, ExternalLink, X, User,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../hooks/usePageTitle'

interface EmailEvent {
  id: string
  event_type: string
  mailgun_id: string | null
  recipient: string
  lead_id: string | null
  template_id: string | null
  subject: string | null
  url: string | null
  error_code: string | null
  error_message: string | null
  event_timestamp: string | null
  created_at: string
}

interface Lead {
  id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
}

interface Template {
  id: string
  name: string
}

type Range = '7d' | '30d' | 'all'
type FilterKey = 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'spam' | 'unsubscribed'

const FILTER_TYPES: Record<FilterKey, string[]> = {
  sent:         ['sent'],
  delivered:    ['delivered'],
  opened:       ['opened'],
  clicked:      ['clicked'],
  failed:       ['failed', 'permanent_fail', 'temporary_fail'],
  spam:         ['complained'],
  unsubscribed: ['unsubscribed'],
}

const RANGE_LABELS: Record<Range, string> = { '7d': '7 Tage', '30d': '30 Tage', 'all': 'Alle' }

const EVENT_META: Record<string, { label: string; icon: React.ElementType; cls: string; dotCls: string }> = {
  sent:          { label: 'Gesendet',     icon: Send,          cls: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',                     dotCls: 'bg-zinc-400' },
  delivered:     { label: 'Zugestellt',   icon: CheckCircle2,  cls: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',                   dotCls: 'bg-blue-400' },
  opened:        { label: 'Geöffnet',     icon: Eye,           cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',        dotCls: 'bg-emerald-400' },
  clicked:       { label: 'Geklickt',     icon: MousePointer2, cls: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',            dotCls: 'bg-violet-400' },
  failed:        { label: 'Fehlgeschl.',  icon: XCircle,       cls: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300',                       dotCls: 'bg-red-400' },
  permanent_fail:{ label: 'Bounce',       icon: XCircle,       cls: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300',                       dotCls: 'bg-red-400' },
  temporary_fail:{ label: 'Soft Bounce',  icon: AlertTriangle,  cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',               dotCls: 'bg-amber-400' },
  complained:    { label: 'Spam',         icon: AlertTriangle,  cls: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300',           dotCls: 'bg-orange-400' },
  unsubscribed:  { label: 'Abgemeldet',   icon: XCircle,       cls: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400',                  dotCls: 'bg-zinc-400' },
}

function pct(a: number, b: number) {
  if (!b) return '–'
  return `${((a / b) * 100).toFixed(1)} %`
}

function fmtDate(iso: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function EventBadge({ type }: { type: string }) {
  const meta = EVENT_META[type] ?? { label: type, icon: Send, cls: 'bg-zinc-100 text-zinc-500', dotCls: 'bg-zinc-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotCls}`} />
      {meta.label}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color, active, onClick }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string
  active?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white dark:bg-zinc-900 border rounded-xl p-5 flex flex-col gap-3 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}
        ${active
          ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/40 dark:ring-emerald-500/30'
          : 'border-zinc-200 dark:border-zinc-800'
        }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={15} />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{label}</p>
      </div>
      {sub && <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </button>
  )
}

export function Auswertung() {
  usePageTitle('Auswertung')
  const [events, setEvents] = useState<EmailEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('30d')
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null)
  const [filterLeads, setFilterLeads] = useState<Lead[]>([])
  const [filterLeadsLoading, setFilterLeadsLoading] = useState(false)
  const [templates, setTemplates] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    let query = supabase
      .from('email_events')
      .select('*')
      .order('event_timestamp', { ascending: false })
      .limit(500)

    if (range !== 'all') {
      const days = range === '7d' ? 7 : 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('event_timestamp', since)
    }

    const { data } = await query
    setEvents((data ?? []) as EmailEvent[])
    setLoading(false)
  }

  useEffect(() => { load() }, [range])

  useEffect(() => {
    supabase.from('email_templates').select('id,name').then(({ data }) => {
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((t: Template) => { map[t.id] = t.name })
      setTemplates(map)
    })
  }, [])

  // Kontakte für aktiven Filter laden
  useEffect(() => {
    if (!activeFilter) { setFilterLeads([]); return }
    const types = FILTER_TYPES[activeFilter]
    const leadIds = [...new Set(
      events.filter(e => types.includes(e.event_type) && e.lead_id).map(e => e.lead_id!)
    )]
    if (leadIds.length === 0) { setFilterLeads([]); return }
    setFilterLeadsLoading(true)
    supabase
      .from('leads')
      .select('id,first_name,last_name,company_name,email')
      .in('id', leadIds)
      .then(({ data }) => {
        setFilterLeads((data ?? []) as Lead[])
        setFilterLeadsLoading(false)
      })
  }, [activeFilter, events])

  function toggleFilter(key: FilterKey) {
    setActiveFilter(prev => prev === key ? null : key)
  }

  const stats = useMemo(() => {
    const byType = (type: string | string[]) => {
      const types = Array.isArray(type) ? type : [type]
      return events.filter(e => types.includes(e.event_type))
    }
    const uniqueBy = (evts: EmailEvent[]) =>
      new Set(evts.map(e => e.mailgun_id).filter(Boolean)).size

    const sent         = byType('sent')
    const delivered    = byType('delivered')
    const opened       = byType('opened')
    const clicked      = byType('clicked')
    const failed       = byType(['failed', 'permanent_fail', 'temporary_fail'])
    const spam         = byType('complained')
    const unsubscribed = byType('unsubscribed')

    const sentCount         = sent.length
    const deliveredCount    = uniqueBy(delivered)
    const openedCount       = uniqueBy(opened)
    const clickedCount      = uniqueBy(clicked)
    const failedCount       = uniqueBy(failed)
    const spamCount         = spam.length
    const unsubscribedCount = unsubscribed.length

    return { sentCount, deliveredCount, openedCount, clickedCount, failedCount, spamCount, unsubscribedCount }
  }, [events])

  const filteredEvents = useMemo(() => {
    const base = events.slice(0, 100)
    if (!activeFilter) return base
    const types = FILTER_TYPES[activeFilter]
    return events.filter(e => types.includes(e.event_type)).slice(0, 100)
  }, [events, activeFilter])

  return (
    <div className="flex flex-col gap-6">

      {/* Kopfzeile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Auswertung</h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
            Öffnungsraten, Bounces und Klicks aus dem Outreach.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${range === r
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon={Send}          label="Gesendet"    value={stats.sentCount}           color="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          active={activeFilter === 'sent'}         onClick={() => toggleFilter('sent')} />
        <KpiCard icon={CheckCircle2}  label="Zugestellt"  value={stats.deliveredCount}      color="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
          sub={pct(stats.deliveredCount, stats.sentCount)}    active={activeFilter === 'delivered'}    onClick={() => toggleFilter('delivered')} />
        <KpiCard icon={Eye}           label="Geöffnet"    value={stats.openedCount}         color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          sub={pct(stats.openedCount, stats.sentCount)}       active={activeFilter === 'opened'}       onClick={() => toggleFilter('opened')} />
        <KpiCard icon={MousePointer2} label="Geklickt"    value={stats.clickedCount}        color="bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400"
          sub={pct(stats.clickedCount, stats.sentCount)}      active={activeFilter === 'clicked'}      onClick={() => toggleFilter('clicked')} />
        <KpiCard icon={XCircle}       label="Bounce"      value={stats.failedCount}         color="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
          sub={pct(stats.failedCount, stats.sentCount)}       active={activeFilter === 'failed'}       onClick={() => toggleFilter('failed')} />
        <KpiCard icon={AlertTriangle} label="Spam"        value={stats.spamCount}           color="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
          sub={pct(stats.spamCount, stats.sentCount)}         active={activeFilter === 'spam'}         onClick={() => toggleFilter('spam')} />
        <KpiCard icon={XCircle}       label="Abgemeldet"  value={stats.unsubscribedCount}   color="bg-zinc-100 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
          sub={pct(stats.unsubscribedCount, stats.sentCount)} active={activeFilter === 'unsubscribed'} onClick={() => toggleFilter('unsubscribed')} />
      </div>

      {/* Kontakte-Panel für aktiven Filter */}
      {activeFilter && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={13} className="text-zinc-400 dark:text-zinc-500" />
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Kontakte: {EVENT_META[FILTER_TYPES[activeFilter][0]]?.label ?? activeFilter}
              </p>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                ({filterLeadsLoading ? '…' : filterLeads.length})
              </span>
            </div>
            <button
              onClick={() => setActiveFilter(null)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          {filterLeadsLoading ? (
            <p className="text-sm text-zinc-400 text-center py-8">Lade Kontakte…</p>
          ) : filterLeads.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">Keine Kontakte mit lead_id für diesen Filter.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filterLeads.map(lead => (
                <div key={lead.id} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(lead.first_name?.[0] ?? lead.company_name?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company_name || '–'}
                    </p>
                    {lead.company_name && (lead.first_name || lead.last_name) && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{lead.company_name}</p>
                    )}
                  </div>
                  <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[200px] hidden sm:block">
                    {lead.email}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raten-Übersicht */}
      {stats.sentCount > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-zinc-400 dark:text-zinc-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Conversion-Funnel</p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Zustellrate',  value: stats.deliveredCount, color: 'bg-blue-400' },
              { label: 'Öffnungsrate', value: stats.openedCount,    color: 'bg-emerald-400' },
              { label: 'Klickrate',    value: stats.clickedCount,   color: 'bg-violet-400' },
            ].map(({ label, value, color }) => {
              const ratio = stats.sentCount ? value / stats.sentCount : 0
              return (
                <div key={label} className="flex items-center gap-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 w-28 shrink-0">{label}</p>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${color}`}
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-14 text-right tabular-nums">
                    {(ratio * 100).toFixed(1)} %
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 w-16 text-right tabular-nums">
                    {value} / {stats.sentCount}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Events-Tabelle */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {activeFilter ? `Events: ${EVENT_META[FILTER_TYPES[activeFilter][0]]?.label ?? activeFilter}` : 'Letzte Events'}
            </p>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{filteredEvents.length} angezeigt</p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-12">Lade Events…</p>
        ) : events.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Send size={24} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Noch keine Events vorhanden.</p>
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">
              Sende erst E-Mails und richte den Mailgun-Webhook ein.
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">Keine Events für diesen Filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Empfänger</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden md:table-cell">Template / Details</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Zeitpunkt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredEvents.map(ev => (
                <tr key={ev.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <EventBadge type={ev.event_type} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono truncate max-w-[200px]">
                      {ev.recipient}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {ev.template_id && templates[ev.template_id] && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[260px]">{templates[ev.template_id]}</p>
                    )}
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline truncate max-w-[260px]"
                      >
                        <ExternalLink size={10} />
                        {ev.url}
                      </a>
                    )}
                    {ev.error_message && ['failed', 'permanent_fail', 'temporary_fail'].includes(ev.event_type) && (
                      <p className="text-xs text-red-500 dark:text-red-400 truncate max-w-[260px]">{ev.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{fmtDate(ev.event_timestamp)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Webhook-Hinweis */}
      <div className="border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 flex flex-col gap-2">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Mailgun-Webhook konfigurieren</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
          Damit Öffnungen, Klicks und Bounces hier erscheinen, muss in{' '}
          <a href="https://app.mailgun.com/app/sending/domains" target="_blank" rel="noopener noreferrer"
            className="underline font-medium">Mailgun unter Webhooks</a>{' '}
          folgende URL für alle Event-Typen eingetragen werden:
        </p>
        <code className="text-xs font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 rounded px-2 py-1 break-all">
          https://hgwnmpuequgrqxewpvaw.supabase.co/functions/v1/mailgun-webhook
        </code>
        <p className="text-xs text-blue-500 dark:text-blue-500">
          Events: delivered · opened · clicked · permanent_fail · temporary_fail · complained · unsubscribed
        </p>
      </div>
    </div>
  )
}
