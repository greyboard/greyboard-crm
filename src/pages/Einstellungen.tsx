import { Sun, Moon, Mail, Clock } from 'lucide-react'
import { useSettings, Settings } from '../hooks/useSettings'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 py-8 border-b border-zinc-200 dark:border-zinc-800 last:border-0">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={15} className="text-zinc-400 dark:text-zinc-500" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{title}</h2>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

const inputCls = 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'

export function Einstellungen() {
  const { settings, update } = useSettings()

  function toggleDay(day: string) {
    const next = settings.sendDays.includes(day)
      ? settings.sendDays.filter(d => d !== day)
      : [...settings.sendDays, day]
    update({ sendDays: next })
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Einstellungen</h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
          Globale Konfiguration für das CRM und den Outreach-Prozess.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-6 divide-y divide-zinc-100 dark:divide-zinc-800">

        {/* Design */}
        <Section
          icon={Sun}
          title="Design"
          description="Wähle zwischen Dark Mode für abgedunkelte Umgebungen und Light Mode für helle Arbeitsplätze."
        >
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
        </Section>

        {/* Outreach-Limits */}
        <Section
          icon={Mail}
          title="Outreach-Limits"
          description="Maximale Anzahl ausgehender E-Mails pro Tag. Schützt vor Spam-Markierung und hält den Versand kontrolliert."
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500">E-Mails pro Tag (Maximum)</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ dailyMax: Math.max(1, settings.dailyMax - 1) })}
                className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg transition-colors flex items-center justify-center"
              >−</button>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.dailyMax}
                onChange={e => update({ dailyMax: Math.max(1, parseInt(e.target.value) || 1) })}
                className={`${inputCls} w-20 text-center font-semibold`}
              />
              <button
                onClick={() => update({ dailyMax: Math.min(100, settings.dailyMax + 1) })}
                className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg transition-colors flex items-center justify-center"
              >+</button>
            </div>
          </div>
        </Section>

        {/* Versandzeiten */}
        <Section
          icon={Clock}
          title="Versandzeiten"
          description="An welchen Wochentagen und in welchem Zeitfenster dürfen E-Mails versendet werden."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-500">Versandtage</label>
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
              <label className="text-xs font-medium text-zinc-500">Zeitfenster</label>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">Von</span>
                  <input
                    type="time"
                    value={settings.sendTimeFrom}
                    onChange={e => update({ sendTimeFrom: e.target.value })}
                    className={`${inputCls} w-32`}
                  />
                </div>
                <span className="text-zinc-300 dark:text-zinc-600 mt-5">–</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">Bis</span>
                  <input
                    type="time"
                    value={settings.sendTimeTo}
                    onChange={e => update({ sendTimeTo: e.target.value })}
                    className={`${inputCls} w-32`}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-100 dark:border-zinc-800">
              Versand aktiv: <span className="font-medium text-zinc-700 dark:text-zinc-300">{settings.sendDays.join(', ')}</span>,{' '}
              {settings.sendTimeFrom}–{settings.sendTimeTo} Uhr
            </p>
          </div>
        </Section>

      </div>
    </div>
  )
}
