// Records login attempts (success + failure) with the caller's IP address, and
// raises security events / Owner notifications when repeated failures are seen.
// Runs with the service role so it can log pre-authentication failed attempts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { email?: string; success?: boolean; user_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const success = body.success !== false;
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  await admin.from("login_history").insert({
    user_id: body.user_id ?? null,
    email,
    ip_address: ip,
    user_agent: ua,
    event_type: success ? "login_success" : "login_failed",
    success,
  });

  if (!success && email) {
    await admin.from("security_events").insert({
      user_id: body.user_id ?? null,
      email,
      type: "failed_login",
      severity: "warning",
      ip_address: ip,
      details: { user_agent: ua },
    });

    // Count failed attempts for this email in the last 15 minutes.
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("login_history")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("success", false)
      .gte("created_at", since);

    if ((count ?? 0) >= 3) {
      await admin.from("security_events").insert({
        email,
        type: "multiple_failed_logins",
        severity: "high",
        ip_address: ip,
        details: { attempts: count, window_minutes: 15 },
      });
      await admin.rpc("notify_owners", {
        _type: "owner_security_alert",
        _title: "Multiple failed logins",
        _body: `${count} failed sign-in attempts for ${email} in 15 minutes.`,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});