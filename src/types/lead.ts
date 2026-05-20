export type LeadStatus = 'Neu' | 'Validiert' | 'Kontaktiert' | 'Antwort erhalten' | 'Nicht interessiert' | 'Nicht geeignet'

export interface Lead {
  id: string
  created_at: string
  company_name: string
  website: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  industry?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  icebreaker: string | null
  status: LeadStatus
  last_action_at: string
  ghl_date_added?: string | null
  ghl_date_updated?: string | null
  gender?: 'm' | 'w' | 'd' | null
  salutation?: 'Du' | 'Sie' | null
}

export type NewLead = Omit<Lead, 'id' | 'created_at' | 'last_action_at'>
