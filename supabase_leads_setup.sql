-- ============================================================
-- Greyboard CRM – Leads-Tabelle (vollständig GHL-kompatibel)
-- Ausführen im Supabase SQL-Editor
-- ============================================================

create table if not exists leads (
  -- Primärschlüssel (CRM-intern)
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamp with time zone default now(),

  -- GHL-Identifikation
  ghl_id               text unique,

  -- GHL: Kernfelder
  company_name         text not null,              -- GHL: Company Name
  website              text not null,              -- GHL: Website
  email                text,                       -- GHL: Email
  phone                text,                       -- GHL: Phone
  first_name           text,                       -- GHL: First Name
  last_name            text,                       -- GHL: Last Name
  full_name            text,                       -- GHL: Contact Name

  -- GHL: Adresse
  address              text,                       -- GHL: Address
  city                 text,                       -- GHL: City
  state                text,                       -- GHL: State
  postal_code          text,                       -- GHL: Postal Code
  country              text,                       -- GHL: Country

  -- GHL: Metadaten
  source               text,                       -- GHL: Source
  type                 text,                       -- GHL: Type
  timezone             text,                       -- GHL: Timezone
  dnd                  boolean default false,       -- GHL: Do Not Disturb
  tags                 jsonb default '[]'::jsonb,   -- GHL: Tags
  additional_emails    jsonb default '[]'::jsonb,   -- GHL: Additional Emails
  custom_fields        jsonb default '[]'::jsonb,   -- GHL: Custom Fields (raw)

  -- Convenience-Spalte (extrahiert aus custom_fields)
  industry             text,                       -- GHL Custom: Branche

  -- GHL: Zeitstempel
  ghl_date_added       timestamp with time zone,   -- GHL: Date Added
  ghl_date_updated     timestamp with time zone,   -- GHL: Date Updated

  -- CRM: Eigene Felder
  icebreaker           text,
  status               text default 'Neu'
                       check (status in ('Neu', 'Validiert', 'Kontaktiert', 'Antwort erhalten', 'Nicht interessiert')),
  last_action_at       timestamp with time zone default now()
);

-- ============================================================
-- Row Level Security (Dev-Modus: voller Zugriff)
-- ============================================================

alter table leads enable row level security;

create policy "dev_full_access"
  on leads for all
  using (true)
  with check (true);

-- ============================================================
-- Indizes
-- ============================================================

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_status_idx     on leads (status);
create index if not exists leads_ghl_id_idx     on leads (ghl_id);

comment on table leads is 'B2B-Outreach-Leads, 1:1 GHL-Feldstruktur';
