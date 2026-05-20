interface KpiCardProps {
  label: string
  value: string | number
  subtext?: string
  accent?: 'emerald' | 'orange' | 'blue' | 'default'
}

const accentMap = {
  emerald: 'text-emerald-500',
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  default: 'text-zinc-900 dark:text-white',
}

export function KpiCard({ label, value, subtext, accent = 'default' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className={`text-4xl font-bold leading-none ${accentMap[accent]}`}>{value}</p>
      {subtext && <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{subtext}</p>}
    </div>
  )
}
