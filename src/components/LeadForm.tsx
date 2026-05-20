import { useState, useEffect } from 'react'
import { PlusCircle, Loader2, XCircle } from 'lucide-react'
import { Lead, NewLead } from '../types/lead'

interface LeadFormProps {
  onSubmit: (lead: NewLead) => Promise<void>
  initialLead?: Lead | null
}

const emptyForm = {
  company_name: '',
  website: '',
  email: '',
  phone: '',
  first_name: '',
  last_name: '',
  full_name: '',
  icebreaker: '',
  gender: '' as 'm' | 'w' | 'd' | '',
  salutation: '' as 'Du' | 'Sie' | '',
}

const inputCls = 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'
const labelCls = 'text-xs text-zinc-500 font-medium'

export function LeadForm({ onSubmit, initialLead }: LeadFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initialLead) return
    setForm({
      company_name: initialLead.company_name ?? '',
      website:      initialLead.website ?? '',
      email:        initialLead.email ?? '',
      phone:        initialLead.phone ?? '',
      first_name:   initialLead.first_name ?? '',
      last_name:    initialLead.last_name ?? '',
      full_name:    initialLead.full_name ?? '',
      icebreaker:   initialLead.icebreaker ?? '',
      gender:       initialLead.gender ?? '',
      salutation:   initialLead.salutation ?? '',
    })
  }, [initialLead?.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'first_name' || name === 'last_name') {
        updated.full_name = `${name === 'first_name' ? value : prev.first_name} ${name === 'last_name' ? value : prev.last_name}`.trim()
      }
      return updated
    })
  }

  async function save(status: 'Validiert' | 'Nicht geeignet') {
    if (!form.company_name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        ...form,
        status,
        industry: null,
        gender: form.gender || null,
        salutation: form.salutation || null,
      })
      setForm(emptyForm)
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    save('Validiert')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        Neuen Lead validieren
      </h2>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Firmenname *</label>
            <input type="text" name="company_name" value={form.company_name} onChange={handleChange}
              placeholder="Dachbau Heiermann GmbH" required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Webseite / Domain *</label>
            <input type="text" name="website" value={form.website} onChange={handleChange}
              placeholder="dachbau-heiermann.de" required className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Vorname</label>
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange}
              placeholder="Klaus" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nachname</label>
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange}
              placeholder="Heiermann" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>E-Mail</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="info@firma.de" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Telefon</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange}
              placeholder="+49 261 ..." className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Anrede</label>
            <select name="salutation" value={form.salutation}
              onChange={e => setForm(p => ({ ...p, salutation: e.target.value as any }))}
              className={inputCls}>
              <option value="">–</option>
              <option value="Du">Du</option>
              <option value="Sie">Sie</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Geschlecht</label>
            <select name="gender" value={form.gender}
              onChange={e => setForm(p => ({ ...p, gender: e.target.value as any }))}
              className={inputCls}>
              <option value="">–</option>
              <option value="m">Männlich (m)</option>
              <option value="w">Weiblich (w)</option>
              <option value="d">Divers (d)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Eisbrecher-Text</label>
          <textarea name="icebreaker" value={form.icebreaker} onChange={handleChange}
            placeholder="Konkrete Beobachtung zur Website oder zum Auftritt des Unternehmens..."
            rows={4} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 mt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors duration-150"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
          {loading ? 'Speichern...' : 'Lead validieren & speichern'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => save('Nicht geeignet')}
          className="flex items-center justify-center gap-2 bg-transparent hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/30 font-medium text-sm rounded-lg px-4 py-2.5 transition-colors duration-150"
        >
          <XCircle size={16} />
          Nicht geeignet
        </button>
      </div>
    </form>
  )
}
