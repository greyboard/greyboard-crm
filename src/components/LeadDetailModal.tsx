import { useEffect, useState } from 'react'
import {
  X, Globe, Mail, User, Phone, MessageSquareText, MapPin,
  Pencil, Check, Loader2,
} from 'lucide-react'
import { Lead, LeadStatus } from '../types/lead'
import { supabase } from '../lib/supabase'

interface LeadDetailModalProps {
  lead: Lead | null
  onClose: () => void
  onUpdate?: (lead: Lead) => void
}

const STATUS_OPTIONS: LeadStatus[] = [
  'Neu', 'Validiert', 'Kontaktiert', 'Antwort erhalten', 'Nicht interessiert', 'Nicht geeignet',
]

const statusClasses: Record<LeadStatus, string> = {
  Neu:                  'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600',
  Validiert:            'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30',
  Kontaktiert:          'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600/50',
  'Antwort erhalten':   'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30',
  'Nicht interessiert': 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30',
  'Nicht geeignet':     'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30',
}

const inputCls = 'w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors'
const labelCls = 'text-xs text-zinc-400 dark:text-zinc-500 mb-1'

export function LeadDetailModal({ lead, onClose, onUpdate }: LeadDetailModalProps) {
  const [isEditing, setIsEditing]   = useState(false)
  const [draft, setDraft]           = useState<Partial<Lead>>({})
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  useEffect(() => {
    setIsEditing(false)
    setDraft({})
    setSaveError(null)
  }, [lead?.id])

  useEffect(() => {
    if (!lead) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { isEditing ? cancelEdit() : onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lead, onClose, isEditing])

  if (!lead) return null

  function startEdit() {
    setDraft({ ...lead })
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setDraft({})
    setSaveError(null)
  }

  async function saveEdit() {
    if (!lead) return
    setSaving(true)
    setSaveError(null)
    const payload = {
      ...draft,
      full_name: [draft.first_name, draft.last_name].filter(Boolean).join(' ') || draft.full_name || null,
    }
    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', lead.id)
      .select()
      .single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    onUpdate?.(data as Lead)
    setIsEditing(false)
  }

  function set(key: keyof Lead) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v = e.target.value
      setDraft(p => ({ ...p, [key]: v === '' ? null : v }))
    }
  }

  function val(key: keyof Lead): string {
    return (draft[key] as string | null | undefined) ?? ''
  }

  const displayName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null
  const rawDate   = lead.ghl_date_added || lead.created_at
  const addedDate = new Date(rawDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  const addressLine = [lead.address].filter(Boolean).join('')
  const cityLine    = [lead.postal_code, lead.city].filter(Boolean).join(' ')
  const regionLine  = [lead.state, lead.country].filter(Boolean).join(', ')
  const fullAddress = [addressLine, cityLine, regionLine].filter(Boolean).join('\n')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={isEditing ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {isEditing ? (
              <input
                value={val('company_name')}
                onChange={set('company_name')}
                className="w-full text-lg font-semibold bg-transparent border-b border-zinc-300 dark:border-zinc-600 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 pb-0.5"
              />
            ) : (
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">{lead.company_name}</h2>
            )}

            {isEditing ? (
              <select
                value={val('status') || lead.status}
                onChange={set('status')}
                className="mt-2 text-xs rounded-lg px-2.5 py-1 font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[lead.status]}`}>
                {lead.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Abbrechen"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 ml-1"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Speichern
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEdit}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelCls}>Vorname</p>
                  <input value={val('first_name')} onChange={set('first_name')} className={inputCls} placeholder="Vorname" />
                </div>
                <div>
                  <p className={labelCls}>Nachname</p>
                  <input value={val('last_name')} onChange={set('last_name')} className={inputCls} placeholder="Nachname" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelCls}>E-Mail</p>
                  <input type="email" value={val('email')} onChange={set('email')} className={inputCls} placeholder="email@firma.de" />
                </div>
                <div>
                  <p className={labelCls}>Telefon</p>
                  <input type="tel" value={val('phone')} onChange={set('phone')} className={inputCls} placeholder="+49 ..." />
                </div>
              </div>
              <div>
                <p className={labelCls}>Website</p>
                <input value={val('website')} onChange={set('website')} className={inputCls} placeholder="firma.de" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelCls}>Anrede</p>
                  <select value={val('salutation')} onChange={set('salutation')} className={inputCls}>
                    <option value="">–</option>
                    <option value="Du">Du</option>
                    <option value="Sie">Sie</option>
                  </select>
                </div>
                <div>
                  <p className={labelCls}>Geschlecht</p>
                  <select value={val('gender')} onChange={set('gender')} className={inputCls}>
                    <option value="">–</option>
                    <option value="m">Männlich (m)</option>
                    <option value="w">Weiblich (w)</option>
                    <option value="d">Divers (d)</option>
                  </select>
                </div>
              </div>
              <div>
                <p className={labelCls}>Branche</p>
                <input value={val('industry')} onChange={set('industry')} className={inputCls} placeholder="Branche" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelCls}>Straße</p>
                  <input value={val('address')} onChange={set('address')} className={inputCls} placeholder="Musterstraße 1" />
                </div>
                <div>
                  <p className={labelCls}>PLZ</p>
                  <input value={val('postal_code')} onChange={set('postal_code')} className={inputCls} placeholder="12345" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelCls}>Stadt</p>
                  <input value={val('city')} onChange={set('city')} className={inputCls} placeholder="Berlin" />
                </div>
                <div>
                  <p className={labelCls}>Kanton / Bundesland</p>
                  <input value={val('state')} onChange={set('state')} className={inputCls} placeholder="Zürich" />
                </div>
              </div>
              <div>
                <p className={labelCls}>Land</p>
                <input value={val('country')} onChange={set('country')} className={inputCls} placeholder="CH" />
              </div>
              <div>
                <p className={labelCls}>Eisbrecher-Text</p>
                <textarea
                  value={val('icebreaker')}
                  onChange={set('icebreaker')}
                  rows={4}
                  className={`${inputCls} resize-none`}
                  placeholder="Beobachtung zur Website oder zum Auftritt..."
                />
              </div>
            </div>
          ) : (
            <>
              {/* Kontaktinfos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 truncate">{lead.website || '–'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{lead.email || '–'}</span>
                </div>
                {displayName && (
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">{displayName}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">{lead.phone}</span>
                  </div>
                )}
                {(lead.gender || lead.salutation) && (
                  <div className="col-span-2 flex items-center gap-2 flex-wrap">
                    {lead.salutation && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        Anrede: {lead.salutation}
                      </span>
                    )}
                    {lead.gender && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {lead.gender === 'm' ? 'Männlich' : lead.gender === 'w' ? 'Weiblich' : 'Divers'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Anschrift */}
              {fullAddress && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-zinc-400 dark:text-zinc-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed">{fullAddress}</p>
                </div>
              )}

              {/* Eisbrecher */}
              {lead.icebreaker && (
                <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquareText size={13} className="text-emerald-500" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                      Eisbrecher-Text
                    </p>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{lead.icebreaker}</p>
                </div>
              )}
            </>
          )}

          {saveError && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{saveError}</p>
          )}

          <p className="text-xs text-zinc-400 dark:text-zinc-600">Hinzugefügt am {addedDate}</p>
        </div>
      </div>
    </div>
  )
}
