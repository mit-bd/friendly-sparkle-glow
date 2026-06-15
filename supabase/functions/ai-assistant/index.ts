import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * AI Smart Expense Assistant.
 *
 * Two actions, both authenticated by the caller's JWT (RLS is respected for `ask`):
 *  - parse: natural language (Bangla / English / Banglish) -> structured transaction
 *           with smart routing (expense | receivable | payable | collection | payment).
 *  - ask:   free-form question answered against the user's actual ledger data.
 *
 * Uses the Lovable AI gateway (LOVABLE_API_KEY). No external keys required.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(messages: Array<{ role: string; content: string }>, jsonMode: boolean) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw new Response("rate_limited", { status: 429 });
  if (res.status === 402) throw new Response("payment_required", { status: 402 });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "") as string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function parsePrompt(text: string, today: string, categories: string[], parties: string[]) {
  return `You are a financial transaction parser for a Bangladeshi business ledger app.
The user dictates or types a transaction in Bangla, English, or "Banglish" (Bangla spoken/written with English/Latin letters). Bangla and Latin digits both appear (০১২৩৪৫৬৭৮৯). Currency is BDT (টাকা / taka / Tk / ৳).

Today's date is ${today}. Resolve relative dates: "today/আজ"=${today}, "yesterday/গতকাল"=the day before, "tomorrow/আগামীকাল"=the next day.

Classify INTENT using these rules:
- "expense": money spent on goods/services (খরচ, কিনলাম, bill, bought, spent, বাজার, খরচ করলাম).
- "receivable": YOU gave/lent money to someone OR someone owes you (ধার দিলাম, দিলাম, ঋণ দিলাম, gave, lent, পাওনা). The person owes you back.
- "payable": YOU borrowed/took money from someone OR you owe them (ধার নিলাম/নিয়েছি, borrowed, took loan, কাছ থেকে নিলাম, দেনা). You owe them back.
- "collection": someone repaid/returned money TO you (ফেরত দিল, পরিশোধ করল, repaid, returned, received back).
- "payment": you repaid money you owed (ফেরত দিলাম, পরিশোধ করলাম, paid back).
- "unknown": cannot determine.

Known expense categories (match the closest by meaning, else null): ${categories.length ? categories.join(", ") : "(none)"}.
Known party names seen before (prefer an exact/closest match for person_name when appropriate): ${parties.length ? parties.join(", ") : "(none)"}.

Return ONLY a JSON object with these keys:
{
  "intent": one of expense|receivable|payable|collection|payment|unknown,
  "person_name": string|null (the other party; null for generic expenses),
  "party_type": string|null (e.g. customer, supplier, employee, friend, or null),
  "amount": number|null (numeric BDT amount, convert Bangla digits to Latin),
  "date": "YYYY-MM-DD"|null (transaction date; default today if a time word implies it),
  "due_date": "YYYY-MM-DD"|null (only if a repayment deadline is mentioned),
  "description": string (short, clean English title, e.g. "Raqib loan", "Hasan repayment", "Bazar groceries"),
  "category_name": string|null (one of the known categories above for expenses, else null),
  "notes": string|null (any extra detail; keep original wording if useful),
  "summary": string (one friendly English sentence describing what happened and its status, e.g. "You lent ৳500 to Raqib today. Status: Pending Collection." or "You borrowed ৳1500 from Arif yesterday. Status: Payable."),
  "confidence": number (0-1)
}

User input: """${text}"""`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "parse") {
      const text = String(body?.text ?? "").slice(0, 2000).trim();
      if (!text) return json({ error: "Empty input." }, 400);
      const today = typeof body?.today === "string" ? body.today : todayISO();
      const categories: string[] = Array.isArray(body?.categories) ? body.categories.slice(0, 60) : [];
      const parties: string[] = Array.isArray(body?.parties) ? body.parties.slice(0, 80) : [];
      const content = await callAI(
        [{ role: "user", content: parsePrompt(text, today, categories, parties) }],
        true,
      );
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { intent: "unknown", summary: "Could not understand the input.", confidence: 0 };
      }
      return json({ result: parsed });
    }

    if (action === "ask") {
      const question = String(body?.question ?? "").slice(0, 500).trim();
      if (!question) return json({ error: "Empty question." }, 400);

      const [recvRes, payRes, expRes] = await Promise.all([
        supabase
          .from("receivables")
          .select("party_name, party_type, amount, collected_amount, due_amount, due_date, status, approval_status, deleted_at")
          .is("deleted_at", null)
          .limit(1000),
        supabase
          .from("payables")
          .select("party_name, party_type, amount, paid_amount, due_amount, due_date, status, approval_status, deleted_at")
          .is("deleted_at", null)
          .limit(1000),
        supabase
          .from("expenses")
          .select("amount, expense_date, description, status")
          .eq("status", "approved")
          .limit(2000),
      ]);

      const recv = (recvRes.data ?? []).filter((r: any) => r.approval_status === "approved" && r.status !== "cancelled");
      const pay = (payRes.data ?? []).filter((p: any) => p.approval_status === "approved" && p.status !== "cancelled");
      const exp = expRes.data ?? [];

      const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
      const byParty = (rows: any[]) => {
        const m = new Map<string, number>();
        for (const r of rows) m.set(r.party_name, (m.get(r.party_name) || 0) + Number(r.due_amount || 0));
        return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 15);
      };
      const now = new Date();
      const thisMonthExp = exp.filter((e: any) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });

      const ctx = {
        currency: "BDT (৳)",
        today: todayISO(),
        receivables: {
          total_outstanding: sum(recv, "due_amount"),
          overdue_outstanding: sum(recv.filter((r: any) => r.status === "overdue"), "due_amount"),
          top_debtors_owing_you: byParty(recv).map(([name, amt]) => ({ name, owes_you: amt })),
        },
        payables: {
          total_outstanding: sum(pay, "due_amount"),
          overdue_outstanding: sum(pay.filter((p: any) => p.status === "overdue"), "due_amount"),
          top_creditors_you_owe: byParty(pay).map(([name, amt]) => ({ name, you_owe: amt })),
        },
        expenses: {
          approved_total_all_time: sum(exp, "amount"),
          this_month_total: sum(thisMonthExp, "amount"),
          this_month_count: thisMonthExp.length,
        },
      };

      const answer = await callAI(
        [
          {
            role: "system",
            content:
              "You are the financial assistant for a Bangladeshi business ledger. Answer the user's question using ONLY the provided JSON ledger data. Reply in the SAME language the user used (Bangla, English, or Banglish). Use ৳ for amounts and format numbers clearly. Be concise and specific. If the data does not contain the answer, say so honestly.",
          },
          { role: "user", content: `Ledger data:\n${JSON.stringify(ctx)}\n\nQuestion: ${question}` },
        ],
        false,
      );
      return json({ answer, context: ctx });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    if (e instanceof Response) {
      const code = e.status;
      const msg = code === 429 ? "Rate limit reached. Please try again shortly." : code === 402 ? "AI credits exhausted. Please add credits." : "AI error.";
      return json({ error: msg }, code);
    }
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});