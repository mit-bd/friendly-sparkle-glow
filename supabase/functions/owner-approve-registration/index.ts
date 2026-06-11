// Owner-only registration review. Approves a request (creating a company and a
// company-admin account), rejects it, or asks for more information. The caller
// must hold the `owner` role; service-role work happens server-side only.
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
  if (!ownerRow) return bad(403, "Only the Owner can review registrations.");

  let body: {
    action?: "approve" | "reject" | "request_info";
    request_id?: string;
    admin_password?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Invalid request body.");
  }

  const { action, request_id } = body;
  if (!request_id) return bad(400, "request_id is required.");
  if (!action || !["approve", "reject", "request_info"].includes(action)) {
    return bad(400, "Invalid action.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: reqRow, error: reqErr } = await admin
    .from("registration_requests").select("*").eq("id", request_id).maybeSingle();
  if (reqErr || !reqRow) return bad(404, "Registration request not found.");
  if (reqRow.status === "approved") return bad(400, "This request was already approved.");

  const now = new Date().toISOString();

  if (action === "reject") {
    await admin.from("registration_requests").update({
      status: "rejected", info_request_note: body.note ?? null,
      reviewed_by: callerId, reviewed_at: now,
    }).eq("id", request_id);
    await admin.from("activity_logs").insert({
      actor_id: callerId, action: "reject", entity_type: "registration_request",
      entity_id: request_id, entity_label: reqRow.company_name,
      metadata: { note: body.note ?? null },
    });
    return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "request_info") {
    if (!body.note) return bad(400, "A note is required when requesting information.");
    await admin.from("registration_requests").update({
      status: "info_requested", info_request_note: body.note,
      reviewed_by: callerId, reviewed_at: now,
    }).eq("id", request_id);
    await admin.from("activity_logs").insert({
      actor_id: callerId, action: "request_info", entity_type: "registration_request",
      entity_id: request_id, entity_label: reqRow.company_name, metadata: { note: body.note },
    });
    return new Response(JSON.stringify({ ok: true, status: "info_requested" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- approve ----
  const password = body.admin_password ?? "";
  if (password.length < 8 || password.length > 72) {
    return bad(400, "An admin password of 8–72 characters is required to approve.");
  }
  const email = (reqRow.email ?? "").trim().toLowerCase();
  if (!email) return bad(400, "Request has no email.");

  // Create the company first.
  const { data: company, error: compErr } = await admin.from("companies").insert({
    name: reqRow.company_name, legal_name: reqRow.company_name,
    email, phone: reqRow.phone, address: reqRow.address,
    status: "active", plan: "free", created_by: callerId,
  }).select().single();
  if (compErr || !company) return bad(500, compErr?.message ?? "Failed to create company.");

  // Create (or reuse) the company-admin auth user.
  let newUserId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    newUserId = existing.id;
    await admin.auth.admin.updateUserById(newUserId, { password, email_confirm: true });
  } else {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: reqRow.contact_name },
    });
    if (cErr || !created.user) {
      await admin.from("companies").delete().eq("id", company.id);
      return bad(400, cErr?.message ?? "Failed to create company admin.");
    }
    newUserId = created.user.id;
  }

  await admin.from("profiles").upsert({
    id: newUserId, full_name: reqRow.contact_name, email,
    phone: reqRow.phone, status: "active", company_id: company.id,
  });
  await admin.from("user_roles").delete().eq("user_id", newUserId);
  await admin.from("user_roles").insert({ user_id: newUserId, role: "admin" });
  await admin.from("companies").update({ admin_user_id: newUserId }).eq("id", company.id);

  await admin.from("registration_requests").update({
    status: "approved", reviewed_by: callerId, reviewed_at: now,
    created_company_id: company.id, created_user_id: newUserId,
  }).eq("id", request_id);

  await admin.from("activity_logs").insert({
    actor_id: callerId, action: "approve", entity_type: "registration_request",
    entity_id: request_id, entity_label: reqRow.company_name,
    metadata: { company_id: company.id, admin_user_id: newUserId },
  });

  return new Response(
    JSON.stringify({ ok: true, status: "approved", company_id: company.id, admin_user_id: newUserId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});