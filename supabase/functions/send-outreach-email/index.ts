import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  to: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  mailgunApiKey: string;
  mailgunDomain: string;
  mailgunRegion?: "us" | "eu";
  metadata?: Record<string, string>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: Payload = await req.json();
    const {
      to,
      fromEmail,
      fromName,
      replyTo,
      subject,
      html,
      text,
      mailgunApiKey,
      mailgunDomain,
      mailgunRegion = "eu",
      metadata,
    } = payload;

    if (!to || !fromEmail || !subject || !html || !mailgunApiKey || !mailgunDomain) {
      return new Response(
        JSON.stringify({ error: "Pflichtfelder fehlen: to, fromEmail, subject, html, mailgunApiKey, mailgunDomain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = mailgunRegion === "eu"
      ? "https://api.eu.mailgun.net"
      : "https://api.mailgun.net";

    const mailgunUrl = `${baseUrl}/v3/${mailgunDomain}/messages`;
    const credentials = btoa(`api:${mailgunApiKey}`);

    // Vollständiges HTML-Dokument sicherstellen, damit Mailgun das Tracking-Pixel
    // korrekt in den <body> einfügen kann.
    const fullHtml = html.trimStart().startsWith("<!DOCTYPE") || html.trimStart().startsWith("<html")
      ? html
      : `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;

    const formData = new FormData();
    formData.append("from", fromName ? `${fromName} <${fromEmail}>` : fromEmail);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("html", fullHtml);
    if (text) formData.append("text", text);
    if (replyTo) formData.append("h:Reply-To", replyTo);
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        formData.append(`v:${key}`, value);
      }
    }

    const response = await fetch(mailgunUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
      body: formData,
    });

    const responseText = await response.text();
    let responseData: { id?: string; message?: string } = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      let errorMessage = `Mailgun Fehler ${response.status}`;
      if (response.status === 401) errorMessage = "Unautorisiert: Bitte prüfe den Mailgun API-Key und die Region (US/EU).";
      else if (response.status === 403) errorMessage = "Zugriff verweigert: Bitte prüfe die IP-Whitelist in den Mailgun-Einstellungen.";
      else if (response.status === 400) errorMessage = `Ungültige Anfrage: ${responseData?.message || "Bitte prüfe die E-Mail-Parameter."}`;
      return new Response(
        JSON.stringify({ error: errorMessage, details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sent-Event in Supabase speichern
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await supabase.from("email_events").insert({
        event_type:      "sent",
        mailgun_id:      responseData.id ?? null,
        recipient:       to,
        lead_id:         metadata?.leadId ?? null,
        template_id:     metadata?.templateId ?? null,
        subject,
        user_variables:  metadata ?? {},
        event_timestamp: new Date().toISOString(),
      });
    } catch (dbErr) {
      // DB-Fehler blockiert den Versand nicht
      console.error("[send-outreach-email] DB log error:", dbErr);
    }

    return new Response(
      JSON.stringify({ id: responseData.id, message: responseData.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Interner Serverfehler";
    console.error("[send-outreach-email]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
