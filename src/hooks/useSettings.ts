import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface Settings {
  theme: 'dark' | 'light'
  dailyMax: number
  sendDays: string[]
  sendTimeFrom: string
  sendTimeTo: string
  emailSignature: string
}

const DEFAULTS: Settings = {
  theme: 'dark',
  dailyMax: 5,
  sendDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  sendTimeFrom: '09:00',
  sendTimeTo: '17:00',
  emailSignature: '',
}

function fromLocal(): Settings {
  try {
    const raw = localStorage.getItem('crm_settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function applyTheme(theme: string) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(fromLocal)
  const [userId, setUserId]     = useState<string | null>(null)

  // Theme sofort anwenden
  useEffect(() => { applyTheme(settings.theme) }, [settings.theme])

  // Einstellungen aus Supabase laden
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const uid = session.user.id
      setUserId(uid)

      supabase
        .from('user_settings')
        .select('data')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.data) {
            // DB-Werte haben Vorrang
            const merged: Settings = { ...DEFAULTS, ...data.data }
            setSettings(merged)
            localStorage.setItem('crm_settings', JSON.stringify(merged))
          } else {
            // Kein DB-Eintrag: lokale Settings hochladen
            const local = fromLocal()
            supabase
              .from('user_settings')
              .upsert({ user_id: uid, data: local, updated_at: new Date().toISOString() })
              .then()
          }
        })
    })
  }, [])

  function update(patch: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem('crm_settings', JSON.stringify(next))
      if (userId) {
        supabase
          .from('user_settings')
          .upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
          .then()
      }
      return next
    })
  }

  return { settings, update }
}
