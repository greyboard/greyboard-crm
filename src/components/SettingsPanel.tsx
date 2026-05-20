import { X, Sun, Moon, Mail, Clock } from 'lucide-react'
import { Settings } from '../hooks/useSettings'

interface SettingsPanelProps {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  onClose: () => void
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function SettingsPanel({ settings, onUpdate, onClose }: SettingsPanelProps) {
  function toggleDay(day: string) {
    const next = settings.sendDays.includes(day)
      ? settings.sendDays.filter(d => d !== day)
      : [...settings.sendDays, day]
    onUpdate({ sendDays: next })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 h-full w-80 z-50 flex flex-col
        bg-white dark:bg-zinc-900
        border-l border-zinc-200 dark:border-zinc-800
        shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Einstellungen</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7">

          {/* Theme */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Design
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['dark', 'light'] as const).map(t => {
                const active = settings.theme === t
                return (
                  <button
                    key={t}
                    onClick={() => onUpdate({ theme: t })}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border transition-colors
                      ${active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    {t === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Daily max */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Mail size={12} />
              E-Mails pro Tag (Maximum)
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdate({ dailyMax: Math.max(1, settings.dailyMax - 1) })}
                className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg leading-none transition-colors flex items-center justify-center"
              >−</button>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.dailyMax}
                onChange={e => onUpdate({ dailyMax: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-16 text-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
              />
              <button
                onClick={() => onUpdate({ dailyMax: Math.min(100, settings.dailyMax + 1) })}
                className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-lg leading-none transition-colors flex items-center justify-center"
              >+</button>
            </div>
          </section>

          {/* Send days */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Versandtage
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(day => {
                const active = settings.sendDays.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                      ${active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Time window */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Clock size={12} />
              Versand-Zeitfenster
            </label>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Von</span>
                <input
                  type="time"
                  value={settings.sendTimeFrom}
                  onChange={e => onUpdate({ sendTimeFrom: e.target.value })}
                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
              <span className="text-zinc-300 dark:text-zinc-600 mt-5">–</span>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Bis</span>
                <input
                  type="time"
                  value={settings.sendTimeTo}
                  onChange={e => onUpdate({ sendTimeTo: e.target.value })}
                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              Versand nur {settings.sendDays.join(', ')} zwischen {settings.sendTimeFrom} und {settings.sendTimeTo} Uhr
            </p>
          </section>

        </div>
      </aside>
    </>
  )
}
