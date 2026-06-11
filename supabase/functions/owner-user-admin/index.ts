// Owner-only user administration: password resets, temporary passwords, account
// suspend/lock/unlock, and role promote/demote. Caller must hold `owner`.
// All actions are written to the immutable activity log.
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
function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%";
  let out = "";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  for (const n of arr) out += chars[n % chars.length];
  return out;
}

const ROLES = ["admin", "manager", "accountant", "viewer"];
const LONG_BAN = "876000h"; // ~100 years

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad(401, "Missing authorization header.");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return bad(401, "Invalid session.");
  const callerId = userData.user.id;

  const { data: ownerRow } = await userClient
    .from("user_roles").select("role").eq("user_id", callerId).eq("role", "owner").maybeSingle();
  if (!ownerRow) return bad(403, "Only the Owner can perform user administration.");

  let body: {
    action?: string;
    user_id?: string;
    role?: string;
    password?: string;
    value?: boolean;
    redirect_to?: string;
  };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid request body.");
  }

  const { action, user_id } = body;
  if (!action) return bad(400, "action is required.");
  if (!user_id) return bad(400, "user_id is required.");
  if (user_id === callerId) return bad(400, "You cannot run this action on your own account.");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: prof } = await admin
    .from("profiles").select("id, full_name, email").eq("id", user_id).maybeSingle();
  if (!prof) return bad(404, "User not found.");
  const label = (prof.full_name as string)?.trim() || (prof.email as string);

  async function log(act: string, metadata: Record<string, unknown> = {}) {
    await admin.from("activity_logs").insert({
      actor_id: callerId, action: act, entity_type: "user",
      entity_id: user_id, entity_label: label, metadata,
    });
  }

  switch (action) {
    case "send_reset_link": {
      const redirectTo = body.redirect_to ?? `${SUPABASE_URL}`;
      const { error } = await userClient.auth.resetPasswordForEmail(prof.email as string, {
        redirectTo,
      });
      if (error) return bad(400, error.message);
      await log("password_reset_link", {});
      return ok({ ok: true });
    }
    case "temp_password": {
      const password = (body.password && body.password.length >= 8) ? body.password : randomPassword();
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return bad(400, error.message);
      await admin.from("profiles").update({ require_password_change: true }).eq("id", user_id);
      await log("temp_password", {});
      return ok({ ok: true, password });
    }
    case "require_password_change": {
      const value = body.value !== false;
      await admin.from("profiles").update({ require_password_change: value }).eq("id", user_id);
      await log("require_password_change", { value });
      return ok({ ok: true, value });
    }
    case "suspend": {
      await admin.auth.admin.updateUserById(user_id, { ban_duration: LONG_BAN });
      await admin.from("profiles")
        .update({ status: "suspended", suspended_at: new Date().toISOString() }).eq("id", user_id);
      await log("user_suspend", {});
      return ok({ ok: true });
    }
    case "lock": {
      await admin.auth.admin.updateUserById(user_id, { ban_duration: LONG_BAN });
      await admin.from("profiles")
        .update({ status: "locked", locked_at: new Date().toISOString() }).eq("id", user_id);
      await log("user_lock", {});
      return ok({ ok: true });
    }
    case "reactivate":
    case "unlock": {
      await admin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      await admin.from("profiles")
        .update({ status: "active", suspended_at: null, locked_at: null }).eq("id", user_id);
      await log(action === "unlock" ? "user_unlock" : "user_reactivate", {});
      return ok({ ok: true });
    }
    case "set_role": {
      const role = body.role ?? "";
      if (!ROLES.includes(role)) return bad(400, "Invalid role.");
      await admin.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await admin.from("user_roles").insert({ user_id, role });
      if (error) return bad(400, error.message);
      await log("permission_change", { role });
      return ok({ ok: true, role });
    }
    default:
      return bad(400, "Unknown action.");
  }
});