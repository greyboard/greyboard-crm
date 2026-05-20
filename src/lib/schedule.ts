import { Settings } from '../hooks/useSettings'

export const DAY_TO_JS: Record<string, number> = {
  Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0,
}

export function buildSchedule(count: number, settings: Settings): Date[] {
  const sendDayNums = new Set(settings.sendDays.map(d => DAY_TO_JS[d]))
  const dates: Date[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1)
  while (dates.length < count) {
    if (sendDayNums.has(cursor.getDay())) {
      for (let i = 0; i < settings.dailyMax && dates.length < count; i++) {
        dates.push(new Date(cursor))
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
