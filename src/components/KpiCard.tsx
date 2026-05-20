import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  subtext?: string
  accent?: 'emerald' | 'orange' | 'blue' | 'default'
  linkTo?: string
  linkLabel?: string
}

const accentMap = {
  emerald: 'text-emerald-500',
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  default: 'text-zinc-900 dark:text-white',
}

export function KpiCard({ label, value, subtext, accent = 'default', linkTo, linkLabel }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className={`text-4xl font-bold leading-none ${accentMap[accent]}`}>{value}</p>
      {subtext && <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{subtext}</p>}
      {linkTo && (
        <Link
          to={linkTo}
          className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors w-fit"
        >
          {linkLabel ?? 'Anzeigen'}
          <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}
