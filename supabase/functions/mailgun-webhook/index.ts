import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mailgun-Event → Lead-Status
// Nur upgraden, niemals downgraden (opened > delivered > sent)
const STATUS_PRIORITY: Record<string, number> = {
  Validiert:       0,
  Kontaktversuch:  1,
  Kontaktiert:     2,
  "Antwort erhalten": 3,
};

const EVENT_TO_STATUS: Record<string, string | null> = {
  delivered:      null,           // kein Status-Wechsel (nur Tracking)
  opened:         "Kontaktiert",
  clicked:        "Kontaktiert",
  complained:     null,
  unsubscribed:   null,
  failed:         "Validiert",    // Bounce → zurück in Queue
  permanent_fail: "Validiert",
  temporary_fail: null,           // Soft-Bounce: erst abwarten
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload   = await req.json();
    const eventData = payload["event-data"];

    if (!eventData) {
      return new Response(JSON.stringify({ error: "No event-data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType    = eventData.event ?? "unknown";
    const mailgunId    = eventData.message?.headers?.["message-id"] ?? eventData.id ?? null;
    const recipient    = eventData.recipient ?? "";
    const ts           = eventData.timestamp
      ? new Date(eventData.timestamp * 1000).toISOString()
      : new Date().toISOString();
    const userVars     = (eventData["user-variables"] as Record<string, string>) ?? {};
    const leadId       = userVars.leadId ?? null;
    const templateId   = userVars.templateId ?? null;
    const subjectFromEvent = (eventData.message?.headers?.subject as string) ?? null;
    const url          = eventData.url ?? null;
    const delivery     = eventData["delivery-status"] as Record<string, unknown> | undefined;
    const errorCode    = delivery?.code?.toString() ?? null;
    // Nur bei echten Fehlern, nicht bei SMTP-Success-Antworten (delivered)
    const isError      = ["failed", "permanent_fail", "temporary_fail"].includes(eventType);
    const errorMessage = isError
      ? ((delivery?.message as string) ?? (delivery?.description as string) ?? null)
      : null;

    // Betreff: aus Event-Headern oder per Lookup aus dem sent-Event
    let subject = subjectFromEvent;
    if (!subject && mailgunId) {
      const { data: sentEvent } = await supabase
        .from("email_events")
        .select("subject")
        .eq("mailgun_id", mailgunId)
        .eq("event_type", "sent")
        .maybeSingle();
      subject = sentEvent?.subject ?? null;
    }

    // Event in DB speichern
    const { error: insertError } = await supabase.from("email_events").insert({
      event_type:      eventType,
      mailgun_id:      mailgunId,
      recipient,
      lead_id:         leadId,
      template_id:     templateId,
      subject,
      url,
      error_code:      errorCode,
      error_message:   errorMessage,
      user_variables:  userVars,
      raw_event:       eventData,
      event_timestamp: ts,
    });

    if (insertError) {
      console.error("[mailgun-webhook] DB insert error:", insertError.message);
    }

    // Lead-Status aktualisieren (nur wenn leadId vorhanden + Status-Mapping definiert)
    const newStatus = EVENT_TO_STATUS[eventType];
    if (leadId && newStatus !== undefined && newStatus !== null) {
      const { data: lead } = await supabase
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single();

      const currentStatus   = lead?.status ?? "";
      const currentPriority = STATUS_PRIORITY[currentStatus] ?? 0;
      const newPriority     = STATUS_PRIORITY[newStatus] ?? 0;

      // Nur upgraden (außer Bounce → immer zurücksetzen)
      const isDowngrade = eventType === "failed" || eventType === "permanent_fail";
      if (isDowngrade || newPriority > currentPriority) {
        await supabase
          .from("leads")
          .update({ status: newStatus, last_action_at: new Date().toISOString() })
          .eq("id", leadId);

        console.log(`[mailgun-webhook] Lead ${leadId}: ${currentStatus} → ${newStatus} (${eventType})`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[mailgun-webhook]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
