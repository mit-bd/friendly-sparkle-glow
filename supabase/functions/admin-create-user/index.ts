// Admin-only user creation. The caller must be authenticated AND hold the
// `admin` role. The service-role key (which bypasses RLS and can create auth
// users) never leaves the server — this is why it lives in an edge function
// rather than the client SPA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: "admin" | "manager" | "accountant" | "viewer";
};

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad(401, "Missing authorization header.");

  // Identify the caller using their bearer token (RLS-scoped).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return bad(401, "Invalid session.");

  // Verify the caller is an admin.
  const { data: adminRow } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!adminRow) return bad(403, "Only admins can create users.");

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid request body.");
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const role = body.role ?? "viewer";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return bad(400, "A valid email is required.");
  }
  if (password.length < 8 || password.length > 72) {
    return bad(400, "Password must be 8–72 characters.");
  }
  if (!fullName) return bad(400, "Full name is required.");
  if (!["admin", "manager", "accountant", "viewer"].includes(role)) {
    return bad(400, "Invalid role.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) {
    return bad(400, createErr?.message ?? "Failed to create user.");
  }

  const newId = created.user.id;

  // The signup trigger created a profile + default role; align them.
  await admin
    .from("profiles")
    .update({ full_name: fullName, phone, email })
    .eq("id", newId);

  await admin.from("user_roles").delete().eq("user_id", newId);
  await admin.from("user_roles").insert({ user_id: newId, role });

  return new Response(JSON.stringify({ id: newId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});