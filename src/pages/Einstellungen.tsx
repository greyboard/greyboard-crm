import { useState } from 'react'
import {
  Sun, Moon, Mail, Clock, Code2, Key, Send, CheckCircle2,
  XCircle, Loader2, Settings2, Zap, Copy, ExternalLink,
} from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { usePageTitle } from '../hooks/usePageTitle'
import { sendOutreachEmail } from '../lib/mailgun'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const SUPABASE_PROJECT_REF = 'hgwnmpuequgrqxewpvaw'
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`

const inputCls =
  'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{children}</label>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
      <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
        <Icon size={14} className="text-zinc-500 dark:text-zinc-400" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function CodeBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-col gap-1">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-950 rounded-lg px-3 py-2.5 group">
        <code className="flex-1 text-xs text-emerald-400 font-mono break-all">{value}</code>
        <button
          onClick={copy}
          className="shrink-0 p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Kopieren"
        >
          {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

// ── Tab-Komponente ─────────────────────────────────────────────────────────────
type Tab = 'allgemein' | 'email' | 'api'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'allgemein', label: 'Allgemein',   icon: Settings2 },
  { id: 'email',     label: 'E-Mail',      icon: Mail },
  { id: 'api',       label: 'API',         icon: Zap },
]

// ── Allgemein-Tab ──────────────────────────────────────────────────────────────
function TabAllgemein() {
  const { settings, update } = useSettings()

  function toggleDay(day: string) {
    const next = settings.sendDays.includes(day)
      ? settings.sendDays.filter(d => d !== day)
      : [...settings.sendDays, day]
    update({ sendDays: next })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Design */}
      <div>
        <SectionTitle
          icon={Sun}
          title="Design"
          description="Dark Mode oder Light Mode für das CRM-Interface."
        />
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map(t => {
            const active = settings.theme === t
            return (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors
                  ${active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
              >
                {t === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {t === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Outreach-Limits */}
      <div>
        <SectionTitle
          icon={Mail}
          title="Outreach-Limits"
          description="Maximale Anzahl ausgehender E-Mails pro Tag."
        />
        <div className="flex flex-col gap-2">
          <Label>E-Mails pro Tag (Maximum)</Label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => update({ dailyMax: Math.max(1, settings.dailyMax - 1) })}
              className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg transition-colors flex items-center justify-center"
            >−</button>
            <input
              type="number" min={1} max={100} value={settings.dailyMax}
              onChange={e => update({ dailyMax: Math.max(1, parseInt(e.target.value) || 1) })}
              className={`${inputCls} w-20 text-center font-semibold`}
            />
            <button
              onClick={() => update({ dailyMax: Math.min(100, settings.dailyMax + 1) })}
              className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg transition-colors flex items-center justify-center"
            >+</button>
          </div>
        </div>
      </div>

      {/* Versandzeiten */}
      <div>
        <SectionTitle
          icon={Clock}
          title="Versandzeiten"
          description="An welchen Wochentagen und in welchem Zeitfenster dürfen E-Mails versendet werden."
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Versandtage</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(day => {
                const active = settings.sendDays.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                      ${active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Zeitfenster</Label>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-600">Von</span>
                <input type="time" value={settings.sendTimeFrom}
                  onChange={e => update({ sendTimeFrom: e.target.value })}
                  className={`${inputCls} w-32`} />
              </div>
              <span className="text-zinc-300 dark:text-zinc-600 mt-5">–</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-600">Bis</span>
                <input type="time" value={settings.sendTimeTo}
                  onChange={e => update({ sendTimeTo: e.target.value })}
                  className={`${inputCls} w-32`} />
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-100 dark:border-zinc-800">
            Versand aktiv: <span className="font-medium text-zinc-700 dark:text-zinc-300">{settings.sendDays.join(', ')}</span>,{' '}
            {settings.sendTimeFrom}–{settings.sendTimeTo} Uhr
          </p>
        </div>
      </div>
    </div>
  )
}

// ── E-Mail-Tab ─────────────────────────────────────────────────────────────────
function TabEmail() {
  const { settings, update } = useSettings()
  const [signatureDraft, setSignatureDraft] = useState(settings.emailSignature)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [mgApiKey,    setMgApiKey]    = useState(settings.mailgunApiKey)
  const [mgDomain,    setMgDomain]    = useState(settings.mailgunDomain)
  const [mgRegion,    setMgRegion]    = useState<'us' | 'eu'>(settings.mailgunRegion)
  const [mgFromEmail, setMgFromEmail] = useState(settings.mailgunFromEmail)
  const [mgFromName,  setMgFromName]  = useState(settings.mailgunFromName)
  const [mgReplyTo,   setMgReplyTo]   = useState(settings.mailgunReplyTo)
  const [mgSaved,     setMgSaved]     = useState(false)
  const [testEmail,   setTestEmail]   = useState('')
  const [testStatus,  setTestStatus]  = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [testError,   setTestError]   = useState('')

  function saveSignature() {
    update({ emailSignature: signatureDraft })
    setSignatureSaved(true)
    setTimeout(() => setSignatureSaved(false), 2000)
  }

  function saveMailgun() {
    update({
      mailgunApiKey:    mgApiKey.trim(),
      mailgunDomain:    mgDomain.trim(),
      mailgunRegion:    mgRegion,
      mailgunFromEmail: mgFromEmail.trim(),
      mailgunFromName:  mgFromName.trim(),
      mailgunReplyTo:   mgReplyTo.trim(),
    })
    setMgSaved(true)
    setTimeout(() => setMgSaved(false), 2000)
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) return
    setTestStatus('sending')
    setTestError('')
    try {
      await sendOutreachEmail({
        to: testEmail.trim(),
        fromEmail: mgFromEmail.trim() || `info@${mgDomain.trim()}`,
        fromName: mgFromName.trim() || undefined,
        replyTo: mgReplyTo.trim() || undefined,
        subject: 'Mailgun Test – Greyboard CRM',
        html: '<p>Diese Test-E-Mail bestätigt, dass Mailgun korrekt konfiguriert ist.</p>',
        text: 'Diese Test-E-Mail bestätigt, dass Mailgun korrekt konfiguriert ist.',
        mailgunApiKey: mgApiKey.trim(),
        mailgunDomain: mgDomain.trim(),
        mailgunRegion: mgRegion,
      })
      setTestStatus('ok')
      setTimeout(() => setTestStatus('idle'), 4000)
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      setTestStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Signatur */}
      <div>
        <SectionTitle
          icon={Code2}
          title="E-Mail-Signatur"
          description="HTML-Signatur, die automatisch an jede ausgehende Outreach-E-Mail angehängt wird."
        />
        <div className="flex flex-col gap-3">
          <textarea
            value={signatureDraft}
            onChange={e => setSignatureDraft(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={'<p>Mit freundlichen Grüßen<br>Max Mustermann</p>'}
            className={`${inputCls} font-mono text-xs resize-y w-full`}
          />
          {signatureDraft && (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/60">
              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">Vorschau</p>
              <div
                className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: signatureDraft }}
              />
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={saveSignature}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors">
              {signatureSaved ? '✓ Gespeichert' : 'Signatur speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Mailgun */}
      <div>
        <SectionTitle
          icon={Key}
          title="Mailgun"
          description="API-Zugangsdaten für den E-Mail-Versand. Der API-Key bleibt serverseitig in der Supabase Edge Function."
        />
        <div className="flex flex-col gap-4">
          <Field label="API-Key (Private Key)">
            <input type="password" value={mgApiKey} onChange={e => setMgApiKey(e.target.value)}
              placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className={inputCls} autoComplete="off" />
          </Field>

          <div className="flex gap-3">
            <Field label="Domain">
              <input type="text" value={mgDomain} onChange={e => setMgDomain(e.target.value)}
                placeholder="mg.example.com" className={`${inputCls} flex-1`} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label>Region</Label>
              <div className="flex gap-1">
                {(['eu', 'us'] as const).map(r => (
                  <button key={r} onClick={() => setMgRegion(r)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors
                      ${mgRegion === r
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300'
                      }`}>
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Absendername">
                <input type="text" value={mgFromName} onChange={e => setMgFromName(e.target.value)}
                  placeholder="Greyboard" className={inputCls} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Absenderadresse">
                <input type="email" value={mgFromEmail} onChange={e => setMgFromEmail(e.target.value)}
                  placeholder="outreach@mg.example.com" className={inputCls} />
              </Field>
            </div>
          </div>

          <Field label="Reply-To (optional)">
            <input type="email" value={mgReplyTo} onChange={e => setMgReplyTo(e.target.value)}
              placeholder="kontakt@example.com" className={inputCls} />
          </Field>

          {/* Test-E-Mail */}
          <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-800/40">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Test-E-Mail</p>
            <div className="flex gap-2">
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com" className={`${inputCls} flex-1`} />
              <button
                onClick={sendTestEmail}
                disabled={testStatus === 'sending' || !testEmail.trim() || !mgApiKey.trim() || !mgDomain.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors disabled:opacity-40"
              >
                {testStatus === 'sending' ? <Loader2 size={14} className="animate-spin" />
                  : testStatus === 'ok' ? <CheckCircle2 size={14} />
                  : testStatus === 'error' ? <XCircle size={14} />
                  : <Send size={14} />}
                {testStatus === 'sending' ? 'Wird gesendet…' : testStatus === 'ok' ? 'Gesendet' : 'Testen'}
              </button>
            </div>
            {testStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400">{testError}</p>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={saveMailgun}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors">
              {mgSaved ? '✓ Gespeichert' : 'Mailgun speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── API-Tab ────────────────────────────────────────────────────────────────────
function TabApi() {
  const { settings } = useSettings()
  const mailgunBase = settings.mailgunRegion === 'eu'
    ? 'https://api.eu.mailgun.net'
    : 'https://api.mailgun.net'
  const domain = settings.mailgunDomain || '<deine-domain>'

  const endpoints = [
    {
      method: 'POST',
      label: 'E-Mail senden (Edge Function)',
      url: `${SUPABASE_URL}/functions/v1/send-outreach-email`,
      description: 'Supabase Edge Function. Nimmt JSON-Payload entgegen, leitet an Mailgun weiter. Erfordert Supabase Auth-Header.',
      example: JSON.stringify({
        to: 'empfaenger@example.com',
        fromEmail: 'outreach@mg.example.com',
        fromName: 'Greyboard',
        subject: 'Betreff',
        html: '<p>E-Mail-Inhalt</p>',
        mailgunApiKey: 'key-xxx',
        mailgunDomain: 'mg.example.com',
        mailgunRegion: 'eu',
      }, null, 2),
    },
    {
      method: 'POST',
      label: 'Mailgun – E-Mail senden (direkt)',
      url: `${mailgunBase}/v3/${domain}/messages`,
      description: 'Mailgun REST-API. Wird intern von der Edge Function verwendet. Nur mit Basic-Auth (api:<API-Key>).',
      example: null,
    },
    {
      method: 'GET',
      label: 'Mailgun – Domain-Status',
      url: `${mailgunBase}/v3/domains/${domain}`,
      description: 'Liefert SPF-, DKIM- und DMARC-Status der konfigurierten Domain.',
      example: null,
    },
  ]

  const methodColor: Record<string, string> = {
    POST: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    GET:  'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionTitle
          icon={Zap}
          title="API-Endpunkte"
          description="Übersicht aller relevanten Endpunkte für den E-Mail-Versand. Die Edge Function ist der einzige Einstiegspunkt aus dem Frontend."
        />

        {/* Infos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Supabase Projekt</p>
            <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{SUPABASE_PROJECT_REF}</p>
            <a href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1">
              Dashboard <ExternalLink size={11} />
            </a>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Mailgun Region</p>
            <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{settings.mailgunRegion.toUpperCase()} · {mailgunBase}</p>
            <a href="https://app.mailgun.com/app/sending/domains"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1">
              Mailgun Dashboard <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Endpunkte */}
        <div className="flex flex-col gap-4">
          {endpoints.map((ep, i) => (
            <div key={i} className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5 ${methodColor[ep.method]}`}>
                  {ep.method}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{ep.label}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{ep.description}</p>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3">
                <CodeBox value={ep.url} label="URL" />
                {ep.example && (
                  <div className="flex flex-col gap-1">
                    <Label>Request-Body (JSON)</Label>
                    <pre className="bg-zinc-900 dark:bg-zinc-950 rounded-lg px-3 py-3 text-xs text-zinc-300 font-mono overflow-x-auto leading-relaxed">
                      {ep.example}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Deploy-Hinweis */}
        <div className="mt-6 border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Edge Function deployen</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Erstelle einen Personal Access Token unter{' '}
            <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer"
              className="underline font-medium">supabase.com/dashboard/account/tokens</a>{' '}
            und führe dann aus:
          </p>
          <CodeBox value={`SUPABASE_ACCESS_TOKEN="sbp_xxx" supabase functions deploy send-outreach-email --project-ref ${SUPABASE_PROJECT_REF}`} />
        </div>
      </div>
    </div>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────────────────────
export function Einstellungen() {
  usePageTitle('Einstellungen')
  const [activeTab, setActiveTab] = useState<Tab>('allgemein')

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Einstellungen</h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
          Globale Konfiguration für das CRM und den Outreach-Prozess.
        </p>
      </div>

      {/* Tab-Navigation */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl mb-6 border border-zinc-200 dark:border-zinc-700">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${active
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab-Inhalt */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        {activeTab === 'allgemein' && <TabAllgemein />}
        {activeTab === 'email'     && <TabEmail />}
        {activeTab === 'api'       && <TabApi />}
      </div>
    </div>
  )
}
