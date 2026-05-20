import { createClient } from '@supabase/supabase-js'

// ── Credentials ────────────────────────────────────────────────────────────────
const GHL_TOKEN    = 'pit-ae6d98a0-c68c-45ab-8676-966690825503'
const GHL_LOCATION = 'z9fAY8LTH7r1fWcEqiXC'

// GHL Custom Field IDs
const CF_BRANCHE     = 'DAeE0ZyDWma2iobOVLQF'
const CF_EISBRECHER  = 'fDtzqBPrkkfzHj2Q1Mws'
const CF_GENDER      = 'OfBZPQrHmOSls5r7kquI'
const CF_SALUTATION  = 'h0TyE8Q3DVB7quTFuit7'

const SUPABASE_URL  = 'https://hgwnmpuequgrqxewpvaw.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd25tcHVlcXVncnF4ZXdwdmF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzMDYxNCwiZXhwIjoyMDk0ODA2NjE0fQ.09OGh0lOmNp09ymRdnQo4YqupUMspP_sh5pNMofHNUQ'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const BATCH_SIZE = 100

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function cf(contact, id) {
  if (!id) return null
  return contact.customFields?.find(f => f.id === id)?.value || null
}

function mapGender(v) {
  if (!v) return null
  const l = v.toLowerCase()
  if (l.includes('männlich') || l === 'm') return 'm'
  if (l.includes('weiblich') || l === 'w') return 'w'
  if (l.includes('divers')   || l === 'd') return 'd'
  return null
}

function mapSalutation(v) {
  if (!v) return null
  if (v === 'Du' || v === 'Sie') return v
  return null
}

function mapContact(c) {
  return {
    ghl_id:            c.id,
    company_name:      c.companyName || c.contactName || 'Unbekannt',
    website:           c.website ? c.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
    email:             c.email         || null,
    phone:             c.phone         || null,
    first_name:        c.firstName     || null,
    last_name:         c.lastName      || null,
    full_name:         c.contactName   || null,
    address:           c.address1      || null,
    city:              c.city          || null,
    state:             c.state         || null,
    postal_code:       c.postalCode    || null,
    country:           c.country       || null,
    source:            c.source        || null,
    type:              c.type          || null,
    timezone:          c.timezone      || null,
    dnd:               c.dnd           ?? false,
    tags:              c.tags          ?? [],
    additional_emails: c.additionalEmails ?? [],
    custom_fields:     c.customFields  ?? [],
    industry:          cf(c, CF_BRANCHE),
    icebreaker:        cf(c, CF_EISBRECHER),
    gender:            mapGender(cf(c, CF_GENDER)),
    salutation:        mapSalutation(cf(c, CF_SALUTATION)),
    ghl_date_added:    c.dateAdded     || null,
    ghl_date_updated:  c.dateUpdated   || null,
    last_action_at:    c.dateUpdated   || c.dateAdded || new Date().toISOString(),
    status:            'Neu',
  }
}

async function fetchAllGHL() {
  const all = []
  let url = `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION}&limit=${BATCH_SIZE}`
  let page = 1

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' },
    })
    if (!res.ok) {
      console.error(`GHL Fehler Seite ${page}:`, res.status, await res.text())
      process.exit(1)
    }
    const data = await res.json()
    all.push(...data.contacts)
    console.log(`  Seite ${page}: ${data.contacts.length} Kontakte geladen (gesamt: ${all.length} / ${data.meta.total})`)
    url = data.meta.nextPageUrl || null
    page++
  }

  return all
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log('=== Greyboard CRM – GHL Vollimport ===\n')

// 1. Bestehende Eisbrecher sichern
console.log('1. Sichere bestehende Eisbrecher aus der DB…')
const { data: existing } = await supabase
  .from('leads')
  .select('ghl_id, icebreaker')
  .not('icebreaker', 'is', null)

const icebreakers = {}
for (const row of (existing || [])) {
  if (row.ghl_id && row.icebreaker) icebreakers[row.ghl_id] = row.icebreaker
}
console.log(`   ${Object.keys(icebreakers).length} Eisbrecher gesichert.\n`)

// 2. Alle Kontakte löschen
console.log('2. Lösche alle bestehenden Kontakte…')
const { error: delError } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delError) { console.error('Löschen fehlgeschlagen:', delError.message); process.exit(1) }
console.log('   ✓ Alle Kontakte gelöscht.\n')

// 3. Alle GHL-Kontakte abrufen
console.log('3. Lade alle Kontakte aus GHL…')
const contacts = await fetchAllGHL()
console.log(`\n   ✓ ${contacts.length} Kontakte aus GHL geladen.\n`)

// 4. In 100er-Batches importieren
console.log('4. Importiere in Batches…')
let imported = 0
let errors   = 0

for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
  const batch = contacts.slice(i, i + BATCH_SIZE)
  const rows  = batch.map(mapContact).filter(r => r.company_name)

  // Eisbrecher aus Sicherung einspielen
  for (const row of rows) {
    if (icebreakers[row.ghl_id]) row.icebreaker = icebreakers[row.ghl_id]
  }

  const { data, error } = await supabase
    .from('leads')
    .insert(rows)
    .select('id')

  if (error) {
    console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} Fehler:`, error.message)
    errors += batch.length
  } else {
    imported += data.length
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ✓ ${data.length} importiert`)
  }
}

console.log(`\n=== Fertig ===`)
console.log(`✓ ${imported} Kontakte importiert`)
if (errors) console.log(`✗ ${errors} Fehler`)
console.log(`★ ${Object.keys(icebreakers).length} Eisbrecher wiederhergestellt`)
