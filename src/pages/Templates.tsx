import { useState, useEffect, useMemo } from 'react'
import { Plus, FileText, Trash2, Loader2, Check, Eye, EyeOff, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RichTextEditor } from '../components/RichTextEditor'
import { Lead } from '../types/lead'

interface EmailTemplate {
  id: string
  created_at: string
  updated_at: string
  name: string
  industry: string | null
  country: string | null
  subject: string
  body: string
}

const INDUSTRIES = [
  'Gartenbau','Fliesenleger','Gipser','Bodenleger','Glaser',
  'Dachdecker','Sanitär','Elektriker','Maler','Schreiner','Sonstige',
]

const inputCls = 'w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'
const selectCls = `${inputCls} cursor-pointer`

function emptyTemplate(): Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'> {
  return { name: '', industry: null, country: null, subject: '', body: '' }
}

function substitute(text: string, lead: Lead): string {
  const map: Record<string, string> = {
    salutation:   lead.salutation  ?? '',
    first_name:   lead.first_name  ?? '',
    last_name:    lead.last_name   ?? '',
    full_name:    lead.full_name   ?? lead.company_name ?? '',
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
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? `{{${key}}}`)
}

// ── Vorschau-Panel ─────────────────────────────────────────────────────────────
function PreviewPanel({
  subject, body, onClose,
}: { subject: string; body: string; onClose: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loadingLeads, setLoadingLeads] = useState(true)

  useEffect(() => {
    supabase.from('leads').select('*').order('company_name').limit(200).then(({ data }) => {
      setLeads((data as Lead[]) ?? [])
      setLoadingLeads(false)
    })
  }, [])

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

  const previewSubject = selectedLead ? substitute(subject, selectedLead) : subject
  const previewBody    = selectedLead ? substitute(body, selectedLead) : body

  // Highlight unresolved placeholders in red
  const highlightedBody = previewBody.replace(
    /\{\{(\w+)\}\}/g,
    '<span style="background:#fef08a;color:#92400e;border-radius:3px;padding:0 2px">{{$1}}</span>'
  )
  const highlightedSubject = previewSubject.replace(
    /\{\{(\w+)\}\}/g,
    '<span style="background:#fef08a;color:#92400e;border-radius:3px;padding:0 2px">{{$1}}</span>'
  )

  return (
    <aside className="w-[400px] shrink-0 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vorschau</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Kontakt-Auswahl */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-2">Kontakt auswählen</p>
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Firma oder Name suchen…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {loadingLeads ? (
          <p className="text-xs text-zinc-400 py-2 text-center">Lade Kontakte…</p>
        ) : (
          <div className="max-h-40 overflow-y-auto flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
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
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
          >
            Kontakt entfernen
          </button>
        )}
      </div>

      {/* E-Mail-Vorschau */}
      <div className="flex-1 overflow-y-auto">
        {/* E-Mail-Kopf */}
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
          {selectedLead && (
            <div className="flex flex-col gap-0.5 mb-2">
              <p className="text-xs text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">An:</span>{' '}
                {selectedLead.full_name
                  ? `${selectedLead.full_name} <${selectedLead.email ?? '–'}>`
                  : selectedLead.email ?? '–'
                }
              </p>
            </div>
          )}
          <p className="text-xs text-zinc-400 mb-0.5 font-medium text-zinc-500 dark:text-zinc-400">Betreff:</p>
          {subject ? (
            <p
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              dangerouslySetInnerHTML={{ __html: highlightedSubject || '<span class="text-zinc-300">–</span>' }}
            />
          ) : (
            <p className="text-sm text-zinc-300 dark:text-zinc-600 italic">Kein Betreff</p>
          )}
        </div>

        {/* E-Mail-Body */}
        <div className="px-4 py-4">
          {body ? (
            <div
              className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed tiptap"
              dangerouslySetInnerHTML={{ __html: highlightedBody }}
            />
          ) : (
            <p className="text-sm text-zinc-300 dark:text-zinc-600 italic">Kein Text vorhanden.</p>
          )}
        </div>
      </div>

      {/* Footer */}
      {!selectedLead && (
        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
          <p className="text-xs text-zinc-400 text-center">
            Kontakt auswählen, um Platzhalter zu befüllen
          </p>
        </div>
      )}
    </aside>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export function Templates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [draft, setDraft] = useState(emptyTemplate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [countries, setCountries] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetchTemplates()
    supabase.from('leads').select('country').neq('country', null).then(({ data }) => {
      const unique = [...new Set((data ?? []).map((r: any) => r.country).filter(Boolean))].sort()
      setCountries(unique)
    })
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    const { data } = await supabase.from('email_templates').select('*').order('industry').order('name')
    setTemplates((data as EmailTemplate[]) ?? [])
    setLoading(false)
  }

  function selectTemplate(t: EmailTemplate) {
    setSelected(t)
    setDraft({ name: t.name, industry: t.industry, country: t.country, subject: t.subject, body: t.body })
    setIsNew(false)
    setSaved(false)
  }

  function newTemplate() {
    setSelected(null)
    setDraft(emptyTemplate())
    setIsNew(true)
    setSaved(false)
  }

  async function save() {
    if (!draft.name.trim()) return
    setSaving(true)
    setSaved(false)
    try {
      if (isNew) {
        const { data, error } = await supabase.from('email_templates').insert([draft]).select().single()
        if (error) throw error
        const t = data as EmailTemplate
        setTemplates(prev =>
          [...prev, t].sort((a, b) => (a.industry ?? '').localeCompare(b.industry ?? '') || a.name.localeCompare(b.name))
        )
        setSelected(t)
        setIsNew(false)
      } else if (selected) {
        const { data, error } = await supabase
          .from('email_templates')
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq('id', selected.id)
          .select().single()
        if (error) throw error
        const t = data as EmailTemplate
        setTemplates(prev => prev.map(x => x.id === t.id ? t : x))
        setSelected(t)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Template wirklich löschen?')) return
    await supabase.from('email_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (selected?.id === id) { setSelected(null); setDraft(emptyTemplate()); setIsNew(false) }
  }

  const grouped = templates.reduce<Record<string, EmailTemplate[]>>((acc, t) => {
    const key = t.industry ?? 'Sonstige'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})

  const hasEditor = selected !== null || isNew

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col gap-3">
        <button
          onClick={newTemplate}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={15} />
          Neues Template
        </button>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          {loading && <p className="text-xs text-zinc-400 text-center py-8">Lade Templates…</p>}
          {!loading && templates.length === 0 && (
            <div className="text-center py-10 px-4">
              <FileText size={18} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">Noch keine Templates.</p>
            </div>
          )}
          {!loading && Object.entries(grouped).map(([industry, items]) => (
            <div key={industry}>
              <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {industry}
              </p>
              {items.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 group ${
                    selected?.id === t.id
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <FileText size={13} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
                  <span className="truncate flex-1">{t.name}</span>
                  {t.country && (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600 shrink-0">{t.country}</span>
                  )}
                  <span
                    onClick={e => { e.stopPropagation(); deleteTemplate(t.id) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Editor ── */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {!hasEditor ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <FileText size={32} className="text-zinc-200 dark:text-zinc-700" />
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Template auswählen oder neu erstellen</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Meta */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
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
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
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
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Betreff</label>
                <input
                  type="text"
                  placeholder="Betreff der E-Mail…"
                  value={draft.subject}
                  onChange={e => setDraft(p => ({ ...p, subject: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* WYSIWYG */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400 dark:text-zinc-500 px-0.5">E-Mail-Text</label>
              <RichTextEditor
                key={selected?.id ?? 'new'}
                content={draft.body}
                onChange={body => setDraft(p => ({ ...p, body }))}
                placeholder="Schreibe hier den E-Mail-Text. Nutze {{ }} um Platzhalter einzufügen…"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pb-6">
              <button
                type="button"
                onClick={() => setPreviewOpen(o => !o)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                  previewOpen
                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {previewOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                {previewOpen ? 'Vorschau schließen' : 'Vorschau'}
              </button>

              <button
                onClick={save}
                disabled={saving || !draft.name.trim()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
                {saving ? 'Speichern…' : saved ? 'Gespeichert' : 'Template speichern'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Vorschau-Panel ── */}
      {previewOpen && hasEditor && (
        <PreviewPanel
          subject={draft.subject}
          body={draft.body}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
