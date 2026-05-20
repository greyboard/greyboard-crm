import { useState, useEffect } from 'react'

export interface Settings {
  theme: 'dark' | 'light'
  dailyMax: number
  sendDays: string[]
  sendTimeFrom: string
  sendTimeTo: string
}

const DEFAULTS: Settings = {
  theme: 'dark',
  dailyMax: 5,
  sendDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  sendTimeFrom: '09:00',
  sendTimeTo: '17:00',
}

function load(): Settings {
  try {
    const raw = localStorage.getItem('crm_settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', settings.theme === 'dark')
    root.classList.toggle('light', settings.theme === 'light')
  }, [settings.theme])

  function update(patch: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem('crm_settings', JSON.stringify(next))
      return next
    })
  }

  return { settings, update }
}
