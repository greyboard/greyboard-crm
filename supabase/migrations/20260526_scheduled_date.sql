ALTER TABLE leads ADD COLUMN IF NOT EXISTS scheduled_date date;
CREATE INDEX IF NOT EXISTS leads_scheduled_date_idx ON leads (scheduled_date);
