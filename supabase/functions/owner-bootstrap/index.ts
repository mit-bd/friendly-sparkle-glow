// One-time Owner bootstrap. Creates the first platform Owner account and
// assigns the `owner` role. Refuses once any owner already exists, so this
// cannot be used to escalate after initial setup. The service-role key never
// leaves the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Hard stop: if an owner already exists, this endpoint is permanently closed.
  const { count, error: cErr } = await admin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "owner");
  if (cErr) return bad(500, cErr.message);
  if ((count ?? 0) > 0) return bad(403, "An owner already exists. Bootstrap is closed.");

  let body: { email?: string; password?: string; full_name?: string };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid request body.");
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim() || "System Owner";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return bad(400, "A valid email is required.");
  }
  if (password.length < 8 || password.length > 72) {
    return bad(400, "Password must be 8–72 characters.");
  }

  // Re-use an existing auth user with this email if present, else create one.
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) return bad(400, createErr?.message ?? "Failed to create owner.");
    userId = created.user.id;
  }

  await admin.from("profiles").upsert({ id: userId, full_name: fullName, email, status: "active" });
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "owner" });
  if (roleErr) return bad(500, roleErr.message);

  await admin.from("activity_logs").insert({
    actor_id: userId,
    action: "bootstrap",
    entity_type: "owner",
    entity_id: userId,
    entity_label: email,
    metadata: { full_name: fullName },
  });

  return new Response(JSON.stringify({ id: userId, email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});