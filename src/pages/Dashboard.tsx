import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { KpiCard } from '../components/KpiCard'
import { StatusBanner } from '../components/StatusBanner'
import { LeadForm } from '../components/LeadForm'
import { PipelineTable } from '../components/PipelineTable'
import { LeadDetailModal } from '../components/LeadDetailModal'
import { Lead, NewLead } from '../types/lead'
import { usePageTitle } from '../hooks/usePageTitle'

const TODAY_SENT = 0

export function Dashboard() {
  usePageTitle()
  const { settings } = useSettings()
  const [leads, setLeads]               = useState<Lead[]>([])
  const [validatedCount, setValidatedCount] = useState(0)
  const [monthCount, setMonthCount]     = useState(0)
  const [loading, setLoading]           = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [filterCountry, setFilterCountry]   = useState('LI')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [countries, setCountries]       = useState<string[]>([])
  const [industries, setIndustries]     = useState<string[]>([])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false })
      .eq('status', 'Neu')
    if (filterCountry)  q = q.eq('country', filterCountry)
    if (filterIndustry) q = q.eq('industry', filterIndustry)
    q = q.limit(10)

    const [{ data }, { count: validated }, { count: month }] = await Promise.all([
      q,
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'Validiert'),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .in('status', ['Kontaktiert', 'Kontaktversuch', 'Antwort erhalten'])
        .gte('last_action_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])
    setLeads((data as Lead[]) ?? [])
    setValidatedCount(validated ?? 0)
    setMonthCount(month ?? 0)
    setLoading(false)
  }, [filterCountry, filterIndustry])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    supabase.from('leads').select('country, industry').then(({ data }) => {
      if (!data) return
      setCountries([...new Set(data.map((r: any) => r.country).filter(Boolean))].sort() as string[])
      setIndustries([...new Set(data.map((r: any) => r.industry).filter(Boolean))].sort() as string[])
    })
  }, [])

  async function handleNewLead(data: NewLead) {
    const { data: inserted, error } = await supabase.from('leads').insert([data]).select().single()
    if (error) throw new Error(error.message)
    setLeads(prev => [inserted as Lead, ...prev].slice(0, 10))
    if (data.status === 'Validiert') setValidatedCount(prev => prev + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner count={validatedCount} />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Validierte Leads"
          value={loading ? '...' : validatedCount}
          subtext="Bereit für Outreach"
          accent="emerald"
          linkTo="/queue"
          linkLabel="Queue anzeigen"
        />
        <KpiCard
          label="Heute gesendet"
          value={`${TODAY_SENT} / ${settings.dailyMax}`}
          subtext={TODAY_SENT >= settings.dailyMax ? 'Tageslimit erreicht' : `Noch ${settings.dailyMax - TODAY_SENT} möglich`}
          accent={TODAY_SENT >= settings.dailyMax ? 'orange' : 'default'}
        />
        <KpiCard
          label="Diesen Monat kontaktiert"
          value={loading ? '...' : monthCount}
          subtext={new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          accent="blue"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        <LeadForm onSubmit={handleNewLead} initialLead={leads[0] ?? null} />
        <PipelineTable
          leads={leads}
          loading={loading}
          onView={setSelectedLead}
          onRefresh={fetchLeads}
          countries={countries}
          industries={industries}
          filterCountry={filterCountry}
          filterIndustry={filterIndustry}
          onFilterCountry={setFilterCountry}
          onFilterIndustry={setFilterIndustry}
        />
      </section>

      <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  )
}
