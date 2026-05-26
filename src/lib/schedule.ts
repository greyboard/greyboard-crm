import { Settings } from '../hooks/useSettings'

// Gibt das Versanddatum (YYYY-MM-DD) für den Lead an Position queueLength (0-basiert).
export function calcScheduledDate(queueLength: number, settings: Settings, sentToday: number): string {
  const schedule = buildSchedule(queueLength + 1, settings, sentToday)
  const date = schedule[queueLength] ?? schedule[schedule.length - 1] ?? new Date()
  return date.toISOString().split('T')[0]
}

export const DAY_TO_JS: Record<string, number> = {
  Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0,
}

export function buildSchedule(count: number, settings: Settings, sentToday = 0): Date[] {
  const sendDayNums = new Set(settings.sendDays.map(d => DAY_TO_JS[d]))
  const dates: Date[] = []

  const zurichHHMM = new Intl.DateTimeFormat('sv', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  const todayStr = cursor.toDateString()

  const windowClosed    = zurichHHMM >= settings.sendTimeTo
  const todayLimitReached = sentToday >= settings.dailyMax
  if (windowClosed || todayLimitReached) {
    cursor.setDate(cursor.getDate() + 1)
  }

  while (dates.length < count) {
    if (sendDayNums.has(cursor.getDay())) {
      const isToday = cursor.toDateString() === todayStr
      const slots   = isToday ? Math.max(0, settings.dailyMax - sentToday) : settings.dailyMax
      for (let i = 0; i < slots && dates.length < count; i++) {
        dates.push(new Date(cursor))
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
