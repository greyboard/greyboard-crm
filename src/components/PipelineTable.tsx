import { Eye, RefreshCw, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Lead } from '../types/lead'
import { StatusBadge } from './StatusSelect'

interface PipelineTableProps {
  leads: Lead[]
  loading: boolean
  onView: (lead: Lead) => void
  onRefresh: () => void
  countries: string[]
  industries: string[]
  filterCountry: string
  filterIndustry: string
  onFilterCountry: (v: string) => void
  onFilterIndustry: (v: string) => void
}


const selectCls = 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer'

const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Schweiz', LI: 'Liechtenstein', DE: 'Deutschland', AT: 'Österreich',
}

export function PipelineTable({
  leads, loading, onView, onRefresh,
  countries, industries, filterCountry, filterIndustry,
  onFilterCountry, onFilterIndustry,
}: PipelineTableProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 shrink-0">
          Rezente Pipeline
        </h2>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <select value={filterCountry} onChange={e => onFilterCountry(e.target.value)} className={selectCls}>
            <option value="">Alle Länder</option>
            {countries.map(c => <option key={c} value={c}>{COUNTRY_NAMES[c] ?? c}</option>)}
          </select>
          <select value={filterIndustry} onChange={e => onFilterIndustry(e.target.value)} className={selectCls}>
            <option value="">Alle Branchen</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 shrink-0"
          title="Aktualisieren"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Firma</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden md:table-cell">Domain</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {loading && leads.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-zinc-400 text-sm">Lade Leads...</td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-zinc-400 text-sm">Keine Leads für diesen Filter.</td>
              </tr>
            )}
            {leads.map(lead => {
              return (
                <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-6 py-3.5">
                    <Link
                      to={`/kontakte?id=${lead.id}`}
                      onClick={e => e.stopPropagation()}
                      className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[180px] block transition-colors"
                    >
                      {lead.company_name}
                    </Link>
                    {lead.industry && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{lead.industry}</p>
                    )}
                  </td>
                  <td className="px-6 py-3.5 hidden md:table-cell">
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-zinc-400 text-xs font-mono hover:text-emerald-500 transition-colors group/link"
                      >
                        <span className="truncate max-w-[140px]">{lead.website}</span>
                        <ExternalLink size={11} className="shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700 text-xs">–</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onView(lead)}
                      className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                      title="Details anzeigen"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
