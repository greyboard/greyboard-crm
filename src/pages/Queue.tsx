import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, FileText, RefreshCw, ArrowRight, Calendar, Eye, X, Send, CheckCircle2, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lead, LeadStatus } from '../types/lead'
import { useSettings } from '../hooks/useSettings'
import { usePageTitle } from '../hooks/usePageTitle'
import { buildSchedule, DAY_TO_JS } from '../lib/schedule'
import { sendOutreachEmail } from '../lib/mailgun'

interface EmailTemplate {
  id: string
  name: string
  industry: string | null
  country: string | null
  subject: string
  pre_header: string | null
  body: string
}

interface QueueRow {
  lead: Lead
  template: EmailTemplate | null
  matchType: 'exact' | 'country' | 'industry' | 'generic' | 'none'
  scheduledDate: Date | null
}

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Schweiz', LI: 'Liechtenstein', DE: 'Deutschland', AT: 'Österreich',
}

const MATCH_LABELS: Record<QueueRow['matchType'], { label: string; cls: string }> = {
  exact:    { label: 'Land + Branche', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30' },
  country:  { label: 'Nur Land',       cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30' },
  industry: { label: 'Nur Branche',    cls: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30' },
  generic:  { label: 'Generisch',      cls: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600/50' },
  none:     { label: 'Kein Template',  cls: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30' },
}

// ── Template-Matching ──────────────────────────────────────────────────────────
function matchTemplate(lead: Lead, templates: EmailTemplate[]): { template: EmailTemplate | null; matchType: QueueRow['matchType'] } {
  const exact      = templates.find(t => t.country === lead.country && t.industry === lead.industry)
  if (exact)      return { template: exact,      matchType: 'exact' }
  const byCountry  = templates.find(t => t.country === lead.country && t.industry === null)
  if (byCountry)  return { template: byCountry,  matchType: 'country' }
  const byIndustry = templates.find(t => t.country === null && t.industry === lead.industry)
  if (byIndustry) return { template: byIndustry, matchType: 'industry' }
  const generic    = templates.find(t => t.country === null && t.industry === null)
  if (generic)    return { template: generic,    matchType: 'generic' }
  return { template: null, matchType: 'none' }
}

// ── Versandplan ────────────────────────────────────────────────────────────────
function fmtDate(d: Date, timeFrom: string, timeTo: string) {
  const day = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} · ${timeFrom}–${timeTo} Uhr`
}

// ── Platzhalter-Ersetzung ──────────────────────────────────────────────────────
function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function substitute(text: string, lead: Lead): string {
  const ln = cap(lead.last_name)
  const fn = cap(lead.full_name ?? lead.company_name)
  const anrede = lead.gender === 'm' ? `Hallo Herr ${ln}` : lead.gender === 'w' ? `Hallo Frau ${ln}` : `Hallo ${fn}`
  const map: Record<string, string> = {
    anrede, salutation: lead.salutation ?? '',
    first_name: cap(lead.first_name), last_name: ln, full_name: fn,
    company_name: lead.company_name ?? '', industry: lead.industry ?? '',
    website: lead.website ?? '', email: lead.email ?? '', phone: lead.phone ?? '',
    address: lead.address ?? '', city: lead.city ?? '', postal_code: lead.postal_code ?? '',
    country: lead.country ?? '', state: lead.state ?? '', gender: lead.gender ?? '',
    icebreaker: lead.icebreaker ?? '',
    id:         lead.id ?? '',
    ghl_id:     lead.ghl_id ?? '',
  }
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const k = key.replace(/^contact\./, '')
    return map[k] ?? `{{${key}}}`
  })
}

// ── Vorschau-Modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  lead, template, signature, scheduledDate, timeFrom, timeTo, onClose,
}: {
  lead: Lead
  template: EmailTemplate
  signature: string
  scheduledDate: Date | null
  timeFrom: string
  timeTo: string
  onClose: () => void
}) {
  const ph = '<span style="background:#fef08a;color:#92400e;border-radius:3px;padding:0 2px">{{$1}}</span>'
  const subject    = substitute(template.subject, lead)
  const preHeader  = template.pre_header ? substitute(template.pre_header, lead) : null
  const body       = substitute(template.body, lead)

  const hlSubject   = subject.replace(/\{\{([\w.]+)\}\}/g, ph)
  const hlPreHeader = preHeader?.replace(/\{\{([\w.]+)\}\}/g, ph) ?? null
  const hlBody      = body.replace(/\{\{([\w.]+)\}\}/g, ph)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl w-full max-w-6xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{lead.company_name}</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {lead.full_name && `${cap(lead.full_name)} · `}
              Template: <span className="font-medium">{template.name}</span>
              {scheduledDate && (
                <> · <span className="text-emerald-600 dark:text-emerald-400">{fmtDate(scheduledDate, timeFrom, timeTo)}</span></>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* E-Mail-Kopf */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 shrink-0">
          <p className="text-xs text-zinc-400 mb-1.5">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">An:</span>{' '}
            {lead.full_name ? `${cap(lead.full_name)} <${lead.email ?? '–'}>` : lead.email ?? '–'}
          </p>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Betreff:</p>
          <p
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            dangerouslySetInnerHTML={{ __html: hlSubject || '<em class="text-zinc-300">–</em>' }}
          />
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2 mb-0.5">Pre-Header:</p>
          {hlPreHeader ? (
            <p
              className="text-xs text-zinc-600 dark:text-zinc-300"
              dangerouslySetInnerHTML={{ __html: hlPreHeader }}
            />
          ) : (
            <p className="text-xs text-zinc-300 dark:text-zinc-600 italic">Kein Pre-Header</p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {template.body ? (
            <div
              className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed tiptap"
              dangerouslySetInnerHTML={{ __html: hlBody }}
            />
          ) : (
            <p className="text-sm text-zinc-300 dark:text-zinc-600 italic">Kein E-Mail-Text vorhanden.</p>
          )}
          {signature && (
            <>
              <hr className="border-zinc-200 dark:border-zinc-700" />
              <div
                className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: signature }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────────────────────
export function Queue() {
  usePageTitle('Queue')
  const { settings } = useSettings()
  const [leads, setLeads] = useState<Lead[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ lead: Lead; template: EmailTemplate; scheduledDate: Date | null } | null>(null)
  const [sentToday, setSentToday] = useState(0)
  const [sending, setSending] = useState<Record<string, 'idle' | 'confirm' | 'sending' | 'ok' | 'error'>>({})
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({})

  const mailgunConfigured = !!(settings.mailgunApiKey && settings.mailgunDomain && settings.mailgunFromEmail)

  async function handleSend(lead: Lead, template: EmailTemplate) {
    if (!lead.email) {
      setSendErrors(e => ({ ...e, [lead.id]: 'Keine E-Mail-Adresse hinterlegt' }))
      setSending(s => ({ ...s, [lead.id]: 'error' }))
      return
    }

    setSending(s => ({ ...s, [lead.id]: 'sending' }))
    setSendErrors(e => { const n = { ...e }; delete n[lead.id]; return n })

    try {
      const subject = substitute(template.subject, lead)
      const bodyText = substitute(template.body, lead)
      const html = settings.emailSignature
        ? `${bodyText}<br><br><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">${settings.emailSignature}`
        : bodyText

      await sendOutreachEmail({
        to: lead.email,
        fromEmail: settings.mailgunFromEmail,
        fromName: settings.mailgunFromName || undefined,
        replyTo: settings.mailgunReplyTo || undefined,
        subject,
        html,
        text: bodyText.replace(/<[^>]+>/g, ''),
        mailgunApiKey: settings.mailgunApiKey,
        mailgunDomain: settings.mailgunDomain,
        mailgunRegion: settings.mailgunRegion,
        metadata: { leadId: lead.id, templateId: template.id },
      })

      // Gesendet → Kontaktversuch (Öffnen → Kontaktiert kommt per Webhook)
      await supabase.from('leads').update({ status: 'Kontaktversuch' as LeadStatus, last_action_at: new Date().toISOString() }).eq('id', lead.id)
      setSending(s => ({ ...s, [lead.id]: 'ok' }))
      // Sofort aus dem lokalen State entfernen – kein Reload nötig
      setTimeout(() => setLeads(prev => prev.filter(l => l.id !== lead.id)), 800)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      setSendErrors(er => ({ ...er, [lead.id]: msg }))
      setSending(s => ({ ...s, [lead.id]: 'error' }))
    }
  }

  async function load() {
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const [{ data: l }, { data: t }, { count: sent }] = await Promise.all([
      supabase.from('leads').select('*').eq('status', 'Validiert' as LeadStatus)
        .order('scheduled_date', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true }),
      supabase.from('email_templates').select('*'),
      supabase.from('email_events').select('id', { count: 'exact', head: true })
        .eq('event_type', 'sent')
        .gte('event_timestamp', todayStart.toISOString())
        .lte('event_timestamp', todayEnd.toISOString()),
    ])
    setLeads((l ?? []) as Lead[])
    setTemplates((t ?? []) as EmailTemplate[])
    setSentToday(sent ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const rows: QueueRow[] = useMemo(() => {
    const matched = leads.map(lead => ({ lead, ...matchTemplate(lead, templates) }))
    const withTpl    = matched.filter(r => r.matchType !== 'none')
    const withoutTpl = matched.filter(r => r.matchType === 'none')

    // Leads ohne scheduled_date (Altbestand) bekommen Fallback-Datum via buildSchedule
    const fallbackLeads = withTpl.filter(r => !r.lead.scheduled_date)
    const fallbackSchedule = buildSchedule(fallbackLeads.length, settings, sentToday)
    let fallbackIdx = 0

    return [
      ...withTpl.map(r => {
        const scheduledDate = r.lead.scheduled_date
          ? new Date(r.lead.scheduled_date + 'T12:00:00')
          : (fallbackSchedule[fallbackIdx++] ?? null)
        return { ...r, scheduledDate }
      }),
      ...withoutTpl.map(r => ({ ...r, scheduledDate: null })),
    ]
  }, [leads, templates, settings, sentToday])

  const withTemplate    = rows.filter(r => r.matchType !== 'none')
  const withoutTemplate = rows.filter(r => r.matchType === 'none')

  const byDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of withTemplate) {
      if (!r.scheduledDate) continue
      const key = r.scheduledDate.toDateString()
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [withTemplate])

  const lastSendDate = useMemo(() => {
    let last: Date | null = null
    for (const r of withTemplate) {
      if (r.scheduledDate && (!last || r.scheduledDate > last)) last = r.scheduledDate
    }
    return last
  }, [withTemplate])

  const duration = lastSendDate
    ? lastSendDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-5">

      {/* Kopfzeile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Outreach-Queue</h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
            {loading ? '…' : (
              <>
                {rows.length} Kontakte · {withTemplate.length} bereit · {byDate.size} Versandtage
                {duration && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {' '}· Automatisches Marketing bis {duration}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Versandplan */}
      {!loading && byDate.size > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-zinc-400 dark:text-zinc-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Versandplan</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...byDate.entries()].map(([dateStr, count]) => {
              const d = new Date(dateStr)
              const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              return (
                <div
                  key={dateStr}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs"
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{count} E-Mails</span>
                  <span className="text-zinc-400 dark:text-zinc-500">{settings.sendTimeFrom}–{settings.sendTimeTo} Uhr</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hinweis: Mailgun nicht konfiguriert */}
      {!loading && !mailgunConfigured && (
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Mailgun ist noch nicht konfiguriert. Trage API-Key, Domain und Absenderadresse in den{' '}
            <Link to="/einstellungen" className="font-semibold underline">Einstellungen</Link> ein, um E-Mails zu senden.
          </p>
        </div>
      )}

      {/* Hinweis: ohne Template */}
      {!loading && withoutTemplate.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <span className="font-semibold">{withoutTemplate.length} Kontakte</span> haben kein passendes Template und sind nicht eingeplant.
          </p>
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-12">Lade Queue…</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText size={24} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Keine validierten Kontakte vorhanden.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Land · Branche</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Template</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden md:table-cell">Geplanter Versand</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {rows.map(({ lead, template, matchType, scheduledDate }) => {
                const match = MATCH_LABELS[matchType]
                return (
                  <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <Link
                        to={`/kontakte?id=${lead.id}`}
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[180px] block transition-colors"
                      >
                        {lead.company_name}
                      </Link>
                      {lead.full_name && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[180px]">{cap(lead.full_name)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {lead.country ? (COUNTRY_NAMES[lead.country] ?? lead.country) : '–'}
                      </span>
                      {lead.industry && (
                        <span className="text-zinc-400 dark:text-zinc-500"> · {lead.industry}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {template ? (
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[180px]">{template.name}</span>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${match.cls}`}>
                          {match.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                      {scheduledDate ? (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          {fmtDate(scheduledDate, settings.sendTimeFrom, settings.sendTimeTo)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-600">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {template && (
                        <div className="flex items-center justify-end gap-1">
                          {/* Senden */}
                          {mailgunConfigured && lead.email && (
                            <div className="flex flex-col items-end gap-1">
                              {sending[lead.id] === 'confirm' ? (
                                <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1">
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Senden?</span>
                                  <button
                                    onClick={() => handleSend(lead, template)}
                                    title="Ja, senden"
                                    className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setSending(s => ({ ...s, [lead.id]: 'idle' }))}
                                    title="Abbrechen"
                                    className="p-1 rounded text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setSending(s => ({ ...s, [lead.id]: 'confirm' }))}
                                  disabled={sending[lead.id] === 'sending' || sending[lead.id] === 'ok'}
                                  title={sending[lead.id] === 'ok' ? 'Gesendet' : 'E-Mail jetzt senden'}
                                  className={`p-1.5 rounded-lg transition-colors
                                    ${sending[lead.id] === 'ok'
                                      ? 'text-emerald-500 dark:text-emerald-400'
                                      : sending[lead.id] === 'error'
                                      ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                      : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 opacity-0 group-hover:opacity-100'
                                    } disabled:cursor-not-allowed`}
                                >
                                  {sending[lead.id] === 'sending'
                                    ? <Loader2 size={15} className="animate-spin" />
                                    : sending[lead.id] === 'ok'
                                    ? <CheckCircle2 size={15} />
                                    : <Send size={15} />}
                                </button>
                              )}
                              {sending[lead.id] === 'error' && sendErrors[lead.id] && (
                                <p className="text-[10px] text-red-500 max-w-[140px] text-right leading-tight">
                                  {sendErrors[lead.id]}
                                </p>
                              )}
                            </div>
                          )}
                          {/* Vorschau */}
                          <button
                            onClick={() => setPreview({ lead, template, scheduledDate })}
                            className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                            title="E-Mail-Vorschau"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Fehlende Kombinationen */}
      {!loading && withoutTemplate.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Fehlende Template-Kombinationen
            </p>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {[...new Map(
              withoutTemplate.map(r => [
                `${r.lead.country ?? '–'}|${r.lead.industry ?? '–'}`,
                { country: r.lead.country, industry: r.lead.industry },
              ])
            ).values()].map(combo => {
              const count = withoutTemplate.filter(
                r => r.lead.country === combo.country && r.lead.industry === combo.industry
              ).length
              return (
                <span
                  key={`${combo.country}|${combo.industry}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  <span>{combo.country ? (COUNTRY_NAMES[combo.country] ?? combo.country) : 'Kein Land'}</span>
                  <ArrowRight size={11} className="text-zinc-300 dark:text-zinc-600" />
                  <span>{combo.industry ?? 'Keine Branche'}</span>
                  <span className="ml-1 text-zinc-400 dark:text-zinc-500">({count}×)</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Vorschau-Modal */}
      {preview && (
        <PreviewModal
          lead={preview.lead}
          template={preview.template}
          signature={settings.emailSignature}
          scheduledDate={preview.scheduledDate}
          timeFrom={settings.sendTimeFrom}
          timeTo={settings.sendTimeTo}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
