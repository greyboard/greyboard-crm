# Greyboard CRM / Outreach

Internes Outreach-Tool der Greyboard Digital-Agentur für die systematische E-Mail-Akquise bei KMU im deutschsprachigen Raum. Verwaltet Kontakte, E-Mail-Templates und die automatisierte Versandqueue, inklusive vollständigem Tracking (Öffnungen, Klicks, Bounces) über Mailgun.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS, Lucide Icons |
| Editor | Tiptap (Rich-Text für Templates) |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| E-Mail | Mailgun REST API (EU-Region) |
| Hosting | Cloudflare Pages (Frontend), Vercel (Cronjob) |
| Cron | Vercel Cron Job, täglich 08:30 UTC |

---

## Architektur

```
Browser (Vite SPA)
    │
    ├── Supabase Auth (Login / Session)
    ├── Supabase DB (leads, email_templates, email_events, user_settings)
    │
    └── Supabase Edge Functions (Deno)
            ├── send-outreach-email   ← manueller Versand aus der Queue
            ├── mailgun-webhook       ← empfängt Events von Mailgun (kein JWT)
            └── process-queue         ← automatischer Versand per Cronjob

Vercel Cron (08:30 UTC täglich)
    └── GET /api/cron → ruft process-queue auf
```

---

## Datenbank

| Tabelle | Inhalt |
|---|---|
| `leads` | 3.255 Kontakte aus GoHighLevel (GHL), Status-basierter Workflow |
| `email_templates` | 15 Templates mit Land/Branche-Matching und Tiptap-HTML |
| `email_events` | Alle Mailgun-Events (sent, delivered, opened, clicked, failed, ...) |
| `user_settings` | Versandeinstellungen, Mailgun-Credentials, Signatur (JSONB) |

### Lead-Status-Workflow

```
Validiert → [E-Mail gesendet] → Kontaktversuch → [E-Mail geöffnet] → Kontaktiert → Antwort erhalten
                                                                              ↑
                                              [Bounce] → zurück zu Validiert
```

---

## Seiten

### Dashboard
KPI-Übersicht: Kontakte nach Status, Tages-/Wochen-Aktivität.

### Kontakte
Vollständige Kontaktliste mit Server-seitigem Paging (100/Seite), Suche, Statusfilter und Queue-Indikator.

### Queue
Alle Kontakte mit Status `Validiert` und passendem Template. Template-Matching nach Priorität:

1. Land + Branche (exakt)
2. Nur Land
3. Nur Branche
4. Generisch (kein Land, keine Branche)

Manueller Versand per Klick mit Vorschau-Modal, Variablen-Substitution (`{{anrede}}`, `{{company_name}}`, `{{icebreaker}}` etc.) und sofortiger optimistischer Entfernung aus der Liste nach Versand.

### Templates
Rich-Text-Editor (Tiptap) mit Variablen-Highlighting, Land/Branche-Zuordnung und Live-Vorschau mit Beispiel-Kontakten.

### Auswertung
E-Mail-Tracking-Dashboard mit Zeitraumfilter (7 Tage / 30 Tage / Alle):
- KPI-Karten: Gesendet, Zugestellt, Geöffnet, Geklickt, Bounce, Spam
- Klick auf KPI-Card filtert Events-Tabelle und zeigt zugehörige Kontakte
- Conversion-Funnel mit Prozentraten

### Einstellungen
Tabs: Allgemein (Theme), E-Mail (Mailgun-Config, Signatur), API (Endpunkte, Deploy-Befehle).

---

## Edge Functions

### `send-outreach-email`
Wird aus der Queue-Seite aufgerufen. Sendet eine einzelne E-Mail über die Mailgun REST API und speichert ein `sent`-Event in `email_events`.

### `mailgun-webhook`
Empfängt alle Mailgun-Events (deployed mit `--no-verify-jwt`). Pro Event:
1. Speichert den Event in `email_events` inkl. Template-Name-Lookup für Betreff
2. Aktualisiert den Lead-Status nach Priorität (nur upgraden, kein Downgrade ausser Bounce)

### `process-queue`
Wird täglich per Vercel Cron aufgerufen. Prüft:
- Wochentag und Zeitfenster in `Europe/Zurich`
- Tageslimit (aus `user_settings`)
- Sendet alle verbleibenden Leads der Queue bis zum Tageslimit

Auth: `Authorization: Bearer <CRON_SECRET>` (Supabase Secret + Vercel Env).

---

## Lokale Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

`.env` (nicht im Repository):
```
VITE_SUPABASE_URL=https://hgwnmpuequgrqxewpvaw.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Edge Functions deployen

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
supabase functions deploy send-outreach-email --project-ref hgwnmpuequgrqxewpvaw
supabase functions deploy process-queue --project-ref hgwnmpuequgrqxewpvaw --no-verify-jwt
supabase functions deploy mailgun-webhook --project-ref hgwnmpuequgrqxewpvaw --no-verify-jwt
```

---

## Vercel Cron Setup

`vercel.json` ist konfiguriert mit `"schedule": "30 8 * * *"` (08:30 UTC).

Entspricht:
- Winter (CET, UTC+1): 09:30 Zurich
- Sommer (CEST, UTC+2): 10:30 Zurich

Benötigte Umgebungsvariablen in Vercel:

| Variable | Wert |
|---|---|
| `CRON_SECRET` | (siehe `.env`) |
| `SUPABASE_URL` | `https://hgwnmpuequgrqxewpvaw.supabase.co` |

---

## Mailgun

- Domain: `outreach.greyboard.net` (EU-Region)
- Tracking: Open + Click aktiviert, Open-Pixel im `<body>` (HTML-Wrapper erforderlich)
- Webhook-URL: `https://hgwnmpuequgrqxewpvaw.supabase.co/functions/v1/mailgun-webhook`
- Webhook-Events: `delivered`, `opened`, `clicked`, `permanent_fail`, `temporary_fail`, `complained`, `unsubscribed`
