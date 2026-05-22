import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const baseUrl =
      mailgunRegion === "eu"
        ? "https://api.eu.mailgun.net"
        : "https://api.mailgun.net";

    const url = `${baseUrl}/v3/${mailgunDomain}/messages`;
    const credentials = btoa(`api:${mailgunApiKey}`);

    const formData = new FormData();
    formData.append("from", fromName ? `${fromName} <${fromEmail}>` : fromEmail);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("html", html);
    if (text) formData.append("text", text);
    if (replyTo) formData.append("h:Reply-To", replyTo);
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        formData.append(`v:${key}`, value);
      }
    }

    const response = await fetch(url, {
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
      if (response.status === 401) {
        errorMessage =
          "Unautorisiert: Bitte prüfe den Mailgun API-Key und die Region (US/EU).";
      } else if (response.status === 403) {
        errorMessage =
          "Zugriff verweigert: Bitte prüfe die IP-Whitelist in den Mailgun-Einstellungen.";
      } else if (response.status === 400) {
        errorMessage = `Ungültige Anfrage: ${responseData?.message || "Bitte prüfe die E-Mail-Parameter."}`;
      }
      return new Response(
        JSON.stringify({ error: errorMessage, details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
