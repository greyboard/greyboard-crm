import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, FileText, Trash2, Loader2, Check, Eye, Search, X, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RichTextEditor } from '../components/RichTextEditor'
import { Lead } from '../types/lead'
import { useSettings } from '../hooks/useSettings'
import { usePageTitle } from '../hooks/usePageTitle'

interface EmailTemplate {
  id: string
  created_at: string
  updated_at: string
  name: string
  industry: string | null
  country: string | null
  subject: string
  pre_header: string | null
  body: string
}

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Schweiz', LI: 'Liechtenstein', DE: 'Deutschland', AT: 'Österreich',
}

const inputCls = 'w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'
const selectCls = `${inputCls} cursor-pointer`

const PLACEHOLDERS: [string, string][] = [
  ['{{anrede}}',       'Dynamische Anrede'],
  ['{{salutation}}',   'Anrede (Du/Sie)'],
  ['{{first_name}}',   'Vorname'],
  ['{{last_name}}',    'Nachname'],
  ['{{full_name}}',    'Vollständiger Name'],
  ['{{company_name}}', 'Firmenname'],
  ['{{industry}}',     'Branche'],
  ['{{website}}',      'Website'],
  ['{{email}}',        'E-Mail'],
  ['{{phone}}',        'Telefon'],
  ['{{city}}',         'Stadt'],
  ['{{state}}',        'Kanton / Bundesland'],
  ['{{icebreaker}}',   'Eisbrecher-Text'],
  ['{{id}}',           'Contact ID'],
  ['{{ghl_id}}',       'GHL ID'],
]

function PlaceholderInput({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)

  function insertTag(tag: string) {
    const el    = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end   = el?.selectionEnd   ?? value.length
    onChange(value.slice(0, start) + tag + value.slice(end))
    setOpen(false)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + tag.length, start + tag.length)
    })
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls + ' pr-14'}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
          className="px-1.5 py-0.5 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          {'{{ }}'}
        </button>
      </div>

      {open && (
        <>
          {/* Transparentes Overlay fängt Klicks außerhalb ab */}
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg min-w-[210px] py-1">
            {PLACEHOLDERS.map(([tag, label]) => (
              <button
                key={tag}
                type="button"
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); insertTag(tag) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-2"
              >
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{tag}</span>
                <span className="text-zinc-400">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function emptyTemplate(): Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'> {
  return { name: '', industry: null, country: null, subject: '', pre_header: null, body: '' }
}

function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function dynamicGreeting(lead: Lead): string {
  const ln = cap(lead.last_name)
  const fn = cap(lead.full_name ?? lead.company_name)
  if (lead.gender === 'm') return `Hallo Herr ${ln}`
  if (lead.gender === 'w') return `Hallo Frau ${ln}`
  return `Hallo ${fn}`
}

function substitute(text: string, lead: Lead): string {
  const map: Record<string, string> = {
    anrede:       dynamicGreeting(lead),
    salutation:   lead.salutation  ?? '',
    first_name:   cap(lead.first_name),
    last_name:    cap(lead.last_name),
    full_name:    cap(lead.full_name ?? lead.company_name),
    company_name: lead.company_name ?? '',
    industry:     lead.industry    ?? '',
    website:      lead.website     ?? '',
    email:        lead.email       ?? '',
    phone:        lead.phone       ?? '',
    address:      lead.address     ?? '',
    city:         lead.city        ?? '',
    postal_code:  lead.postal_code ?? '',
    country:      lead.country     ?? '',
    state:        lead.state       ?? '',
    gender:       lead.gender      ?? '',
    icebreaker:   lead.icebreaker  ?? '',
    id:           lead.id          ?? '',
    ghl_id:       lead.ghl_id ?? '',
  }
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const k = key.replace(/^contact\./, '')
    return map[k] ?? `{{${key}}}`
  })
}

// ── Vorschau-Panel ─────────────────────────────────────────────────────────────
function PreviewModal({
  subject, pre_header, body, signature, country, industry, onClose,
}: { subject: string; pre_header: string | null; body: string; signature: string; country: string | null; industry: string | null; onClose: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loadingLeads, setLoadingLeads] = useState(true)

  useEffect(() => {
    let q = supabase.from('leads').select('*').order('company_name').limit(200)
    if (country)  q = q.eq('country', country)
    if (industry) q = q.eq('industry', industry)
    q.then(({ data }) => {
      setLeads((data as Lead[]) ?? [])
      setLoadingLeads(false)
    })
  }, [country, industry])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? leads.filter(l =>
          l.company_name.toLowerCase().includes(q) ||
          (l.full_name ?? '').toLowerCase().includes(q) ||
          (l.industry ?? '').toLowerCase().includes(q)
        )
      : leads
  }, [leads, query])

  const previewSubject    = selectedLead ? substitute(subject, selectedLead) : subject
  const previewPreHeader  = pre_header ? (selectedLead ? substitute(pre_header, selectedLead) : pre_header) : null
  const previewBody       = selectedLead ? substitute(body, selectedLead) : body

  const ph = '<span style="background:#fef08a;color:#92400e;border-radius:3px;padding:0 2px">{{$1}}</span>'
  const highlightedBody      = previewBody.replace(/\{\{([\w.]+)\}\}/g, ph)
  const highlightedSubject   = previewSubject.replace(/\{\{([\w.]+)\}\}/g, ph)
  const highlightedPreHeader = previewPreHeader?.replace(/\{\{([\w.]+)\}\}/g, ph) ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl w-full max-w-6xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vorschau</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Kontakt-Auswahl */}
          <div className="w-64 shrink-0 border-r border-zinc-100 dark:border-zinc-800 flex flex-col p-4 gap-3 overflow-y-auto">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Kontakt auswählen</p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Suchen…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {loadingLeads ? (
              <p className="text-xs text-zinc-400 py-2 text-center">Lade…</p>
            ) : (
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                {filtered.length === 0 && (
                  <p className="text-xs text-zinc-400 py-3 text-center">Keine Treffer</p>
                )}
                {filtered.slice(0, 50).map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      selectedLead?.id === lead.id
                        ? 'bg-emerald-50 dark:bg-emerald-500/10'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{lead.company_name}</p>
                    {(lead.full_name || lead.industry) && (
                      <p className="text-xs text-zinc-400 truncate">
                        {[lead.full_name, lead.industry].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedLead && (
              <button
                onClick={() => setSelectedLead(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline text-left"
              >
                Kontakt entfernen
              </button>
            )}
          </div>

          {/* E-Mail-Vorschau */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
              {selectedLead && (
                <p className="text-xs text-zinc-400 mb-2">
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">An:</span>{' '}
                  {selectedLead.full_name
                    ? `${selectedLead.full_name} <${selectedLead.email ?? '–'}>`
                    : selectedLead.email ?? '–'
                  }
                </p>
              )}
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Betreff:</p>
              {subject ? (
                <p
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  dangerouslySetInnerHTML={{ __html: highlightedSubject }}
                />
              ) : (
                <p className="text-sm text-zinc-300 dark:text-zinc-600 italic">Kein Betreff</p>
              )}
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2 mb-0.5">Pre-Header:</p>
              {highlightedPreHeader ? (
                <p
                  className="text-xs text-zinc-600 dark:text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: highlightedPreHeader }}
                />
              ) : (
                <p className="text-xs text-zinc-300 dark:text-zinc-600 italic">Kein Pre-Header</p>
              )}
            </div>

            <div className="px-6 py-5 flex-1 flex flex-col gap-4">
              {body ? (
                <div
                  className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed tiptap"
                  dangerouslySetInnerHTML={{ __html: highlightedBody }}
                />
              ) : (
                <p className="text-sm text-zinc-300 dark:text-zinc-600 italic">Kein Text vorhanden.</p>
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

            {!selectedLead && (
              <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <p className="text-xs text-zinc-400 text-center">
                  Kontakt auswählen, um Platzhalter zu befüllen
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export function Templates() {
  usePageTitle('Templates')
  const { settings } = useSettings()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState(emptyTemplate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [countries, setCountries] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  useEffect(() => {
    fetchTemplates()
    supabase.from('leads').select('country').neq('country', null).then(({ data }) => {
      const unique = [...new Set((data ?? []).map((r: any) => r.country).filter(Boolean))].sort()
      setCountries(unique)
    })
    supabase.from('leads').select('industry').neq('industry', null).then(({ data }) => {
      const unique = [...new Set((data ?? []).map((r: any) => r.industry).filter(Boolean))].sort()
      setIndustries(unique)
    })
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    const { data } = await supabase.from('email_templates').select('*').order('country').order('industry').order('name')
    setTemplates((data as EmailTemplate[]) ?? [])
    setLoading(false)
  }

  function startEdit(t: EmailTemplate) {
    setDraft({ name: t.name, industry: t.industry, country: t.country, subject: t.subject, pre_header: t.pre_header, body: t.body })
    setEditingId(t.id)
  }

  function startNew() {
    setDraft(emptyTemplate())
    setEditingId('new')
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(emptyTemplate())
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function save() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const { data, error } = await supabase.from('email_templates').insert([draft]).select().single()
        if (error) throw error
        const t = data as EmailTemplate
        setTemplates(prev =>
          [...prev, t].sort((a, b) => (a.country ?? '').localeCompare(b.country ?? '') || (a.industry ?? '').localeCompare(b.industry ?? '') || a.name.localeCompare(b.name))
        )
      } else if (editingId) {
        const { data, error } = await supabase
          .from('email_templates')
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select().single()
        if (error) throw error
        const t = data as EmailTemplate
        setTemplates(prev => prev.map(x => x.id === t.id ? t : x))
      }
      cancelEdit()
      showToast(`„${draft.name}" gespeichert.`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Template wirklich löschen?')) return
    await supabase.from('email_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (editingId === id) cancelEdit()
  }

  const isEditing = editingId !== null
  const editingTemplate = templates.find(t => t.id === editingId) ?? null

  const usedIndustries = useMemo(() => new Set(
    templates
      .filter(t => t.country === draft.country && t.industry !== null && t.id !== editingId)
      .map(t => t.industry as string)
  ), [templates, draft.country, editingId])

  return (
    <div className="flex flex-col gap-5">

      {/* Kopfzeile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">E-Mail Templates</h1>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
            {loading ? '…' : `${templates.length} Templates`}
          </p>
        </div>
        {isEditing ? (
          <button
            onClick={save}
            disabled={saving || !draft.name.trim()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Speichern…' : 'Template speichern'}
          </button>
        ) : (
          <button
            onClick={startNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={15} />
            Neues Template
          </button>
        )}
      </div>

      {/* Editor (erscheint über der Liste) */}
      {isEditing && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {editingId === 'new' ? 'Neues Template' : 'Template bearbeiten'}
            </h2>
            <button
              onClick={cancelEdit}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Name des Templates</label>
              <input
                type="text"
                placeholder="z.B. Gartenbau CH – Kalt"
                value={draft.name}
                onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Branche</label>
              <select
                value={draft.industry ?? ''}
                onChange={e => setDraft(p => ({ ...p, industry: e.target.value || null }))}
                className={selectCls}
              >
                <option value="">Alle Branchen</option>
                {industries.map(i => (
                  <option key={i} value={i} disabled={usedIndustries.has(i)}>
                    {i}{usedIndustries.has(i) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Land</label>
              <select
                value={draft.country ?? ''}
                onChange={e => setDraft(p => ({ ...p, country: e.target.value || null }))}
                className={selectCls}
              >
                <option value="">Alle Länder</option>
                {countries.map(c => <option key={c} value={c}>{COUNTRY_NAMES[c] ?? c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Betreff</label>
            <PlaceholderInput
              value={draft.subject}
              onChange={v => setDraft(p => ({ ...p, subject: v }))}
              placeholder="Betreff der E-Mail…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Pre-Header (Vorschautext)</label>
            <PlaceholderInput
              value={draft.pre_header ?? ''}
              onChange={v => setDraft(p => ({ ...p, pre_header: v || null }))}
              placeholder="Kurzer Vorschautext, der in E-Mail-Clients angezeigt wird…"
            />
          </div>

          {/* WYSIWYG */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500 px-0.5">E-Mail-Text</label>
            <RichTextEditor
              key={editingId}
              content={draft.body}
              onChange={body => setDraft(p => ({ ...p, body }))}
              placeholder="Schreibe hier den E-Mail-Text. Nutze {{ }} um Platzhalter einzufügen…"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center pt-1">
            <button
              type="button"
              onClick={() => {
                const t = editingId === 'new'
                  ? { ...draft, id: '', created_at: '', updated_at: '' } as EmailTemplate
                  : editingTemplate
                if (t) setPreviewTemplate({ ...t, ...draft })
              }}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Eye size={15} />
              Vorschau
            </button>
          </div>
        </div>
      )}

      {/* Template-Liste */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-12">Lade Templates…</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText size={24} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Noch keine Templates vorhanden.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Branche</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Land</th>
                <th className="px-4 py-3 w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {templates.map(t => (
                <tr
                  key={t.id}
                  className={`transition-colors ${editingId === t.id ? 'bg-emerald-50 dark:bg-emerald-500/5' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[220px]">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                    {t.industry ?? <span className="text-zinc-300 dark:text-zinc-600">–</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                    {t.country ? (COUNTRY_NAMES[t.country] ?? t.country) : <span className="text-zinc-300 dark:text-zinc-600">–</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewTemplate(t)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Vorschau"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Vorschau-Modal */}
      {previewTemplate && (
        <PreviewModal
          subject={previewTemplate.subject}
          pre_header={previewTemplate.pre_header}
          body={previewTemplate.body}
          signature={settings.emailSignature}
          country={previewTemplate.country}
          industry={previewTemplate.industry}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
          <Check size={15} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
