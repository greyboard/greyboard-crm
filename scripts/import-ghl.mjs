import { createClient } from '@supabase/supabase-js'

const GHL_TOKEN    = 'pit-ae6d98a0-c68c-45ab-8676-966690825503'
const GHL_LOCATION = 'z9fAY8LTH7r1fWcEqiXC'
const GHL_BRANCHE  = 'DAeE0ZyDWma2iobOVLQF'
const SUPABASE_URL = 'https://hgwnmpuequgrqxewpvaw.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd25tcHVlcXVncnF4ZXdwdmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzA2MTQsImV4cCI6MjA5NDgwNjYxNH0.sfQwn0wZ6oRzp_L7DEfLztN2aNPrftumIk4KPfHH_58'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LIMIT = parseInt(process.argv[2] ?? '20', 10)

const res = await fetch(
  `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION}&limit=${LIMIT}`,
  { headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' } }
)

if (!res.ok) { console.error('GHL:', res.status, await res.text()); process.exit(1) }

const { contacts } = await res.json()
console.log(`${contacts.length} Kontakte aus GHL geladen.\n`)

function mapContact(c) {
  const branche = c.customFields?.find(f => f.id === GHL_BRANCHE)
  return {
    // Identifikation
    ghl_id:           c.id,
    // Kernfelder (GHL-Standard)
    company_name:     c.companyName || c.contactName || 'Unbekannt',
    website:          (c.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    email:            c.email        || null,
    phone:            c.phone        || null,
    first_name:       c.firstName    || null,
    last_name:        c.lastName     || null,
    full_name:        c.contactName  || null,
    // Adresse
    address:          c.address1     || null,
    city:             c.city         || null,
    state:            c.state        || null,
    postal_code:      c.postalCode   || null,
    country:          c.country      || null,
    // Metadaten
    source:           c.source       || null,
    type:             c.type         || null,
    timezone:         c.timezone     || null,
    dnd:              c.dnd          ?? false,
    tags:             c.tags         ?? [],
    additional_emails: c.additionalEmails ?? [],
    // Custom Fields (raw + Convenience-Spalte Branche)
    custom_fields:    c.customFields  ?? [],
    industry:         branche?.value  || null,
    // GHL-Zeitstempel
    ghl_date_added:   c.dateAdded    || null,
    ghl_date_updated: c.dateUpdated  || null,
    // CRM-Status
    status:           'Neu',
  }
}

const rows = contacts.map(mapContact).filter(r => r.company_name)

const { data, error } = await supabase
  .from('leads')
  .upsert(rows, { onConflict: 'ghl_id' })
  .select('id, company_name, industry, status')

if (error) { console.error('Supabase:', error.message); process.exit(1) }

console.log(`✓ ${data.length} Leads importiert/aktualisiert:\n`)
data.forEach(l => console.log(`  • ${l.company_name.padEnd(50)} [${(l.industry ?? '–').padEnd(14)}] ${l.status}`))
