import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wochentage: JS getDay() → deutsche Abkürzung (So=0, Mo=1, …, Sa=6)
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  gender: string | null;
  salutation: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  state: string | null;
  icebreaker: string | null;
  ghl_id: string | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  pre_header: string | null;
  country: string | null;
  industry: string | null;
}

interface Settings {
  dailyMax: number;
  sendDays: string[];
  sendTimeFrom: string;
  sendTimeTo: string;
  emailSignature: string;
  mailgunApiKey: string;
  mailgunDomain: string;
  mailgunRegion: "us" | "eu";
  mailgunFromEmail: string;
  mailgunFromName: string;
  mailgunReplyTo: string;
}

function cap(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function substitute(text: string, lead: Lead): string {
  const ln = cap(lead.last_name);
  const fn = cap(lead.full_name ?? lead.company_name);
  const anrede =
    lead.gender === "m"
      ? `Hallo Herr ${ln}`
      : lead.gender === "w"
      ? `Hallo Frau ${ln}`
      : `Hallo ${fn}`;
  const map: Record<string, string> = {
    anrede,
    salutation: lead.salutation ?? "",
    first_name: cap(lead.first_name),
    last_name: ln,
    full_name: fn,
    company_name: lead.company_name ?? "",
    industry: lead.industry ?? "",
    website: lead.website ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    postal_code: lead.postal_code ?? "",
    country: lead.country ?? "",
    state: lead.state ?? "",
    gender: lead.gender ?? "",
    icebreaker: lead.icebreaker ?? "",
    id: lead.id ?? "",
    ghl_id: lead.ghl_id ?? "",
  };
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const k = key.toLowerCase();
    return map[k] ?? `{{${key}}}`;
  });
}

function matchTemplate(
  lead: Lead,
  templates: Template[]
): Template | null {
  const exact = templates.find(
    (t) => t.country === lead.country && t.industry === lead.industry
  );
  if (exact) return exact;
  const byCountry = templates.find(
    (t) => t.country === lead.country && t.industry === null
  );
  if (byCountry) return byCountry;
  const byIndustry = templates.find(
    (t) => t.country === null && t.industry === lead.industry
  );
  if (byIndustry) return byIndustry;
  const generic = templates.find(
    (t) => t.country === null && t.industry === null
  );
  return generic ?? null;
}

// Gibt Datum und Zeit in Europe/Zurich zurück
function zurichNow() {
  const now = new Date();

  // YYYY-MM-DD im Zurich-Timezone (sv-Locale = ISO-Format)
  const dateStr = new Intl.DateTimeFormat("sv", {
    timeZone: "Europe/Zurich",
  }).format(now); // "2026-05-22"

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour   = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const hhmm   = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  // Wochentag: JS getDay() über lokalen Wochentag-Index
  const dayIndex = new Date(dateStr + "T12:00:00Z").getDay(); // Annäherung für Zurich
  // Genauer: über Datum-String
  const zurichDate = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
  );
  const weekday = WEEKDAYS[zurichDate.getDay()];

  return { dateStr, hhmm, weekday };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // ── 1. Settings laden (erster Eintrag) ──────────────────────────────────
    const { data: settingsRow } = await supabase
      .from("user_settings")
      .select("data")
      .limit(1)
      .maybeSingle();

    if (!settingsRow?.data) {
      return json({ ok: false, reason: "no settings found" });
    }

    const s: Settings = settingsRow.data as Settings;

    if (!s.mailgunApiKey || !s.mailgunDomain) {
      return json({ ok: false, reason: "mailgun not configured" });
    }

    // ── 2. Zeit-Fenster prüfen (Europe/Zurich) ──────────────────────────────
    const { dateStr, hhmm, weekday } = zurichNow();

    if (!s.sendDays.includes(weekday)) {
      return json({ ok: false, reason: `not a send day (${weekday})` });
    }

    if (hhmm < s.sendTimeFrom || hhmm >= s.sendTimeTo) {
      return json({
        ok: false,
        reason: `outside send window (${hhmm} not in ${s.sendTimeFrom}–${s.sendTimeTo})`,
      });
    }

    // ── 3. Heutiges Tageslimit prüfen ───────────────────────────────────────
    // Zurich-Tagesgrenzen als UTC-Timestamps
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd   = new Date(dateStr + "T23:59:59");

    // Adjust for Zurich offset (CET=+1, CEST=+2)
    // Einfacher: Filter per event_timestamp >= dateStr (ISO date comparison)
    const { count: sentToday } = await supabase
      .from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "sent")
      .gte("event_timestamp", dateStr + "T00:00:00+01:00")
      .lte("event_timestamp", dateStr + "T23:59:59+02:00"); // beide Offsets abdecken

    const alreadySent = sentToday ?? 0;
    const remaining   = s.dailyMax - alreadySent;

    if (remaining <= 0) {
      return json({
        ok: false,
        reason: `daily limit reached (${alreadySent}/${s.dailyMax})`,
      });
    }

    // ── 4. Leads + Templates laden ──────────────────────────────────────────
    const [leadsRes, templatesRes] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id,email,first_name,last_name,full_name,company_name,industry,country,gender,salutation,website,phone,address,city,postal_code,state,icebreaker,ghl_id"
        )
        .eq("status", "Validiert")
        .not("email", "is", null)
        .order("created_at", { ascending: true })
        .limit(remaining),
      supabase
        .from("email_templates")
        .select("id,name,subject,body,pre_header,country,industry"),
    ]);

    const leads     = (leadsRes.data ?? []) as Lead[];
    const templates = (templatesRes.data ?? []) as Template[];

    if (leads.length === 0) {
      return json({ ok: true, sent: 0, skipped: 0, reason: "queue empty" });
    }

    // ── 5. Leads verarbeiten ─────────────────────────────────────────────────
    const mailgunBase =
      s.mailgunRegion === "eu"
        ? "https://api.eu.mailgun.net"
        : "https://api.mailgun.net";
    const endpoint = `${mailgunBase}/v3/${s.mailgunDomain}/messages`;
    const authHeader =
      "Basic " + btoa(`api:${s.mailgunApiKey}`);

    let sent    = 0;
    let skipped = 0;

    for (const lead of leads) {
      const template = matchTemplate(lead, templates);

      if (!template) {
        skipped++;
        console.log(`[process-queue] Lead ${lead.id}: no template match`);
        continue;
      }

      const subject  = substitute(template.subject, lead);
      const rawBody  = substitute(template.body, lead);
      const bodyHtml = s.emailSignature ? rawBody + "\n\n" + s.emailSignature : rawBody;
      const html     = bodyHtml.trimStart().startsWith("<!DOCTYPE") || bodyHtml.trimStart().startsWith("<html")
        ? bodyHtml
        : `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyHtml}</body></html>`;
      const text     = bodyHtml.replace(/<[^>]+>/g, "");

      const form = new FormData();
      form.append("from", s.mailgunFromName ? `${s.mailgunFromName} <${s.mailgunFromEmail}>` : s.mailgunFromEmail);
      form.append("to", lead.email);
      form.append("subject", subject);
      form.append("html", html);
      form.append("text", text);
      if (s.mailgunReplyTo) form.append("h:Reply-To", s.mailgunReplyTo);
      form.append("v:leadId", lead.id);
      form.append("v:templateId", template.id);
      if (template.pre_header) {
        form.append("h:X-Pre-Header", substitute(template.pre_header, lead));
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: authHeader },
          body: form,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[process-queue] Mailgun error for ${lead.email}: ${errText}`);
          skipped++;
          continue;
        }

        const mgData = await res.json() as { id?: string; message?: string };

        // Status + Event parallel schreiben
        await Promise.all([
          supabase
            .from("leads")
            .update({ status: "Kontaktversuch" })
            .eq("id", lead.id),
          supabase.from("email_events").insert({
            event_type:      "sent",
            mailgun_id:      mgData.id ?? null,
            recipient:       lead.email,
            lead_id:         lead.id,
            template_id:     template.id,
            user_variables:  { leadId: lead.id, templateId: template.id },
            event_timestamp: new Date().toISOString(),
          }),
        ]);

        sent++;
        console.log(`[process-queue] Sent to ${lead.email} (lead ${lead.id})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[process-queue] Error for lead ${lead.id}: ${msg}`);
        skipped++;
      }
    }

    return json({ ok: true, sent, skipped, dailyLimit: s.dailyMax, alreadySent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[process-queue]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
