-- E-Mail-Events: gesendete Mails + Mailgun-Webhook-Events
CREATE TABLE IF NOT EXISTS email_events (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type       TEXT        NOT NULL,  -- sent | delivered | opened | clicked | failed | complained | unsubscribed
  mailgun_id       TEXT,                  -- Mailgun message-id
  recipient        TEXT        NOT NULL,
  lead_id          TEXT,
  template_id      TEXT,
  subject          TEXT,
  url              TEXT,                  -- nur bei clicked
  error_code       TEXT,                  -- nur bei failed
  error_message    TEXT,                  -- nur bei failed
  user_variables   JSONB,
  raw_event        JSONB,
  event_timestamp  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_events_event_type_idx      ON email_events (event_type);
CREATE INDEX IF NOT EXISTS email_events_lead_id_idx         ON email_events (lead_id);
CREATE INDEX IF NOT EXISTS email_events_mailgun_id_idx      ON email_events (mailgun_id);
CREATE INDEX IF NOT EXISTS email_events_event_timestamp_idx ON email_events (event_timestamp DESC);

-- RLS: jeder eingeloggte User darf lesen, Service Role schreibt
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_events"
  ON email_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert email_events"
  ON email_events FOR INSERT
  TO service_role
  WITH CHECK (true);
