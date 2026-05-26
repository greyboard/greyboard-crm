import { Settings } from '../hooks/useSettings'

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
