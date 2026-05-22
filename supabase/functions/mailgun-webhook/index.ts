import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Mailgun sendet application/json (webhook v3)
    const payload = await req.json();
    const eventData = payload["event-data"];

    if (!eventData) {
      return new Response(JSON.stringify({ error: "No event-data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType     = eventData.event ?? "unknown";
    const mailgunId     = eventData.message?.headers?.["message-id"] ?? eventData.id ?? null;
    const recipient     = eventData.recipient ?? "";
    const ts            = eventData.timestamp
      ? new Date(eventData.timestamp * 1000).toISOString()
      : new Date().toISOString();
    const userVars      = (eventData["user-variables"] as Record<string, string>) ?? {};
    const leadId        = userVars.leadId ?? null;
    const templateId    = userVars.templateId ?? null;
    const url           = eventData.url ?? null;
    const delivery      = eventData["delivery-status"] as Record<string, unknown> | undefined;
    const errorCode     = delivery?.code?.toString() ?? null;
    const errorMessage  = (delivery?.message as string) ?? (delivery?.description as string) ?? null;

    const { error } = await supabase.from("email_events").insert({
      event_type:      eventType,
      mailgun_id:      mailgunId,
      recipient,
      lead_id:         leadId,
      template_id:     templateId,
      url,
      error_code:      errorCode,
      error_message:   errorMessage,
      user_variables:  userVars,
      raw_event:       eventData,
      event_timestamp: ts,
    });

    if (error) {
      console.error("[mailgun-webhook] DB error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
