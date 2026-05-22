export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  // Vercel setzt Authorization: Bearer <CRON_SECRET> automatisch bei Cron-Requests
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl || !cronSecret) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL oder CRON_SECRET fehlt" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  console.log("[cron] process-queue result:", JSON.stringify(data));

  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}
