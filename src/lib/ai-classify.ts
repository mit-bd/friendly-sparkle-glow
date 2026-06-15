import { supabase } from "@/integrations/supabase/client";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/expenses";

/**
 * AI-Assisted Expense Classification — fully local engine.
 *
 * No external API. Suggestions are derived from:
 *  1. Direct & fuzzy matching against EXISTING category / subcategory names.
 *  2. A curated keyword → concept dictionary (Category Intelligence Rules).
 *  3. A learning layer of past user corrections (ai_classification_feedback).
 *
 * The engine NEVER creates categories. It only suggests existing categories,
 * and may propose creating a NEW subcategory under an existing category.
 */

/* ----------------------------- Normalisation ---------------------------- */

const STOP_WORDS = new Set([
  "the", "a", "an", "for", "of", "to", "and", "or", "in", "on", "at", "by",
  "with", "from", "this", "that", "is", "are", "was", "new", "june", "july",
  "may", "april", "march", "jan", "feb", "month", "monthly", "bill", "charge",
  "cost", "fee", "payment", "purchase", "expense", "campaign", "subscription",
]);

export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/* --------------------------- Keyword dictionary ------------------------- */

/**
 * Each rule maps keywords to a CONCEPT. A concept resolves to an actual
 * category by matching category-name patterns present in the database, so it
 * works regardless of the exact admin-defined category names.
 */
interface ConceptRule {
  /** Preferred subcategory-name keywords (matched against existing subs). */
  sub?: string[];
  /** Keywords that signal this concept in the description. */
  keywords: string[];
  /** Category-name patterns used to resolve the concept to a real category. */
  categoryPatterns: string[];
  /** Preferred subcategory label when proposing creation. */
  proposeSub?: string;
}

const CONCEPT_RULES: ConceptRule[] = [
  // Packaging materials → typically Product Cost / Packaging Cost
  {
    keywords: ["carton", "poly", "polythene", "tape", "bubble", "wrap", "packaging", "shrink", "label", "sticker", "barcode"],
    categoryPatterns: ["packaging", "product"],
    proposeSub: "Packaging Materials",
  },
  // Product / inventory
  {
    keywords: ["product", "raw", "material", "inventory", "stock", "supply", "goods", "merchandise"],
    categoryPatterns: ["product"],
    proposeSub: "Product Purchase",
  },
  // Marketing
  {
    sub: ["facebook ads", "google ads", "tiktok ads", "influencer"],
    keywords: ["facebook", "fb", "meta", "boost", "google", "adwords", "tiktok", "tik tok", "capcut", "canva", "chatgpt", "openai", "ads", "ad", "marketing", "influencer", "youtube", "promotion", "ppc"],
    categoryPatterns: ["marketing"],
    proposeSub: "Marketing Tool",
  },
  // Logistics / courier
  {
    sub: ["courier charge", "delivery charge", "cod charge"],
    keywords: ["courier", "delivery", "shipping", "cod", "pathao", "steadfast", "redx", "sundarban", "parcel", "logistics"],
    categoryPatterns: ["logistics", "courier", "delivery"],
    proposeSub: "Courier Charge",
  },
  // Fixed cost — salary, rent, internet, software subscription, hosting
  {
    sub: ["employee salary", "office rent", "warehouse rent", "internet bill"],
    keywords: ["salary", "wage", "payroll", "rent", "hosting", "domain", "server", "saas", "software", "license"],
    categoryPatterns: ["fixed"],
    proposeSub: "Recurring Cost",
  },
  // Office maintenance / equipment / stationery
  {
    sub: ["stationery", "tissue", "soap"],
    keywords: ["office", "chair", "table", "printer", "stationery", "pen", "paper", "cartridge", "toner", "equipment", "furniture", "tissue", "soap", "cleaning", "lysol", "harpic", "maintenance"],
    categoryPatterns: ["office", "maintenance"],
    proposeSub: "Office Supplies",
  },
  // Utilities
  {
    sub: ["electricity bill", "water bill", "mobile bill", "ip pbx bill"],
    keywords: ["electricity", "electric", "power", "water", "gas", "mobile", "sim", "recharge", "internet", "broadband", "wifi", "isp", "pbx", "telephone", "landline", "utility"],
    categoryPatterns: ["utility"],
    proposeSub: "Utility Bill",
  },
  // Financial cost
  {
    keywords: ["bank", "transfer", "gateway", "transaction", "interest", "loan", "financial", "vat", "tax", "duty"],
    categoryPatterns: ["financial", "finance"],
    proposeSub: "Bank Charge",
  },
  // Meals / welfare
  {
    sub: ["lunch", "dinner", "tea", "coffee", "snacks", "breakfast"],
    keywords: ["lunch", "dinner", "tea", "coffee", "snacks", "breakfast", "meal", "food", "refreshment", "iftar"],
    categoryPatterns: ["welfare", "employee"],
    proposeSub: "Staff Meal",
  },
  // Guest hospitality
  {
    sub: ["guest dinner", "guest lunch", "meeting refreshments"],
    keywords: ["guest", "hospitality", "client", "visitor", "meeting"],
    categoryPatterns: ["guest", "hospitality"],
    proposeSub: "Guest Hospitality",
  },
  // Returns
  {
    sub: ["product return", "refund loss"],
    keywords: ["return", "returned", "refund"],
    categoryPatterns: ["loss", "return", "adjustment"],
    proposeSub: "Product Return",
  },
  // Damage
  {
    sub: ["damage cost"],
    keywords: ["damage", "damaged", "broken", "spoiled", "expired", "wastage"],
    categoryPatterns: ["loss", "damage", "adjustment"],
    proposeSub: "Damage Cost",
  },
];

/** Items that strongly indicate a recurring Fixed Cost. */
const FIXED_COST_SIGNALS = [
  "salary", "rent", "internet bill", "electricity bill", "water bill",
  "software subscription", "hosting", "hosting renewal", "subscription",
  "payroll", "domain renewal", "lease",
];

/* ------------------------------ Engine types ----------------------------- */

export interface Suggestion {
  categoryId: string | null;
  categoryName: string | null;
  /** Existing subcategory match (when one exists). */
  subcategoryId: string | null;
  subcategoryName: string | null;
  /** Proposed new subcategory name when no existing match fits. */
  proposeSubcategoryName: string | null;
  confidence: number; // 0-100
  isFixedCost: boolean;
  source: "history" | "subcategory" | "keyword" | "none";
}

export interface ClassifyInput {
  description: string;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  /** Past corrections, most-recent first, used to bias suggestions. */
  history?: ClassificationFeedback[];
}

/* ------------------------------- Scoring -------------------------------- */

function categoryMatchesPatterns(name: string, patterns: string[]): boolean {
  const n = name.toLowerCase();
  return patterns.some((p) => n.includes(p));
}

/** Score how strongly a phrase matches a description (0-1). */
function phraseScore(descTokens: string[], descNorm: string, phrase: string): number {
  const pNorm = normalize(phrase);
  if (!pNorm) return 0;
  if (descNorm.includes(pNorm)) return 1; // full phrase present
  const pTokens = pNorm.split(" ").filter((t) => t.length > 1);
  if (pTokens.length === 0) return 0;
  const hits = pTokens.filter((t) => descTokens.includes(t)).length;
  return hits / pTokens.length;
}

export function classify(input: ClassifyInput): Suggestion | null {
  const { description, categories, subcategories, history = [] } = input;
  const descNorm = normalize(description);
  if (descNorm.length < 2) return null;
  const descTokens = tokens(description);

  const activeCats = categories.filter((c) => c.is_active !== false);
  const activeSubs = subcategories.filter((s) => s.is_active !== false);
  const catById = new Map(activeCats.map((c) => [c.id, c]));

  const empty: Suggestion = {
    categoryId: null, categoryName: null,
    subcategoryId: null, subcategoryName: null,
    proposeSubcategoryName: null, confidence: 0,
    isFixedCost: false, source: "none",
  };

  const isFixedCost = FIXED_COST_SIGNALS.some((s) => descNorm.includes(normalize(s)));

  /* 1) Learning layer — does a similar past correction exist? */
  let best: Suggestion | null = null;
  for (const h of history) {
    if (!h.chosen_category_id) continue;
    const sc = phraseScore(descTokens, descNorm, h.normalized_text);
    const reverse = phraseScore(normalize(h.normalized_text).split(" "), descNorm, descNorm);
    const score = Math.max(sc, reverse);
    if (score >= 0.6 && catById.has(h.chosen_category_id)) {
      const cat = catById.get(h.chosen_category_id)!;
      const sub = h.chosen_subcategory_id
        ? activeSubs.find((s) => s.id === h.chosen_subcategory_id)
        : undefined;
      best = {
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: sub?.id ?? null,
        subcategoryName: sub?.name ?? null,
        proposeSubcategoryName: null,
        confidence: Math.min(99, Math.round(80 + score * 19)),
        isFixedCost,
        source: "history",
      };
      break;
    }
  }
  if (best) return best;

  /* 2) Direct subcategory matching (most reliable, data-driven). */
  let bestSub: { sub: ExpenseSubcategory; score: number } | null = null;
  for (const sub of activeSubs) {
    const s = phraseScore(descTokens, descNorm, sub.name);
    if (s > 0 && (!bestSub || s > bestSub.score)) bestSub = { sub, score: s };
  }
  if (bestSub && bestSub.score >= 0.5) {
    const cat = catById.get(bestSub.sub.category_id);
    if (cat) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: bestSub.sub.id,
        subcategoryName: bestSub.sub.name,
        proposeSubcategoryName: null,
        confidence: Math.min(98, Math.round(70 + bestSub.score * 28)),
        isFixedCost,
        source: "subcategory",
      };
    }
  }

  /* 3) Concept keyword rules → resolve to existing category. */
  let bestConcept: { rule: ConceptRule; score: number } | null = null;
  for (const rule of CONCEPT_RULES) {
    const kwHits = rule.keywords.filter((k) => descNorm.includes(normalize(k))).length;
    if (kwHits === 0) continue;
    const score = kwHits / Math.max(2, rule.keywords.length / 3);
    if (!bestConcept || score > bestConcept.score) bestConcept = { rule, score };
  }

  if (bestConcept) {
    const { rule } = bestConcept;
    const cat = activeCats.find((c) => categoryMatchesPatterns(c.name, rule.categoryPatterns));
    if (cat) {
      // Try to find an existing subcategory in this category that fits.
      const catSubs = activeSubs.filter((s) => s.category_id === cat.id);
      let chosenSub: ExpenseSubcategory | undefined;
      let subScore = 0;
      for (const s of catSubs) {
        const sc = phraseScore(descTokens, descNorm, s.name);
        if (sc > subScore) { subScore = sc; chosenSub = s; }
      }
      // Also try preferred sub keywords from the rule.
      if (subScore < 0.5 && rule.sub) {
        for (const s of catSubs) {
          if (rule.sub.some((rs) => normalize(s.name) === normalize(rs))) {
            chosenSub = s; subScore = 0.6; break;
          }
        }
      }
      const useExisting = chosenSub && subScore >= 0.4;
      const confidence = Math.min(95, Math.round(55 + bestConcept.score * 25 + (useExisting ? 10 : 0)));
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: useExisting ? chosenSub!.id : null,
        subcategoryName: useExisting ? chosenSub!.name : null,
        proposeSubcategoryName: useExisting ? null : (rule.proposeSub ?? null),
        confidence,
        isFixedCost,
        source: "keyword",
      };
    }
  }

  /* 4) Weak subcategory match as last resort. */
  if (bestSub && bestSub.score > 0) {
    const cat = catById.get(bestSub.sub.category_id);
    if (cat) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        subcategoryId: bestSub.sub.id,
        subcategoryName: bestSub.sub.name,
        proposeSubcategoryName: null,
        confidence: Math.min(60, Math.round(40 + bestSub.score * 20)),
        isFixedCost,
        source: "subcategory",
      };
    }
  }

  return isFixedCost ? { ...empty, isFixedCost } : null;
}

/* ----------------------------- Learning layer --------------------------- */

export interface ClassificationFeedback {
  id: string;
  description_text: string;
  normalized_text: string;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  chosen_category_id: string | null;
  chosen_subcategory_id: string | null;
  was_override: boolean;
  created_by: string | null;
  created_at: string;
}

const db = supabase as unknown as { from: (t: string) => any };

/** Load recent corrections to bias future suggestions. */
export async function fetchClassificationHistory(limit = 500): Promise<ClassificationFeedback[]> {
  try {
    const { data, error } = await db
      .from("ai_classification_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ClassificationFeedback[];
  } catch {
    return [];
  }
}

/** Record a user's final decision so the engine learns from corrections. */
export async function recordClassificationFeedback(input: {
  description: string;
  suggestedCategoryId: string | null;
  suggestedSubcategoryId: string | null;
  chosenCategoryId: string | null;
  chosenSubcategoryId: string | null;
  createdBy: string;
}): Promise<void> {
  try {
    const wasOverride =
      input.suggestedCategoryId !== null &&
      (input.suggestedCategoryId !== input.chosenCategoryId ||
        input.suggestedSubcategoryId !== input.chosenSubcategoryId);
    await db.from("ai_classification_feedback").insert({
      description_text: input.description.slice(0, 500),
      normalized_text: normalize(input.description).slice(0, 500),
      suggested_category_id: input.suggestedCategoryId,
      suggested_subcategory_id: input.suggestedSubcategoryId,
      chosen_category_id: input.chosenCategoryId,
      chosen_subcategory_id: input.chosenSubcategoryId,
      was_override: wasOverride,
      created_by: input.createdBy,
    });
  } catch {
    /* learning is best-effort; never block expense creation */
  }
}

/**
 * Auto-create a subcategory under an EXISTING category, marked AI generated.
 * Returns the new subcategory id, or null on failure.
 */
export async function createAiSubcategory(input: {
  categoryId: string;
  name: string;
  createdBy: string;
}): Promise<{ id: string; name: string } | null> {
  const name = input.name.trim();
  if (!name || !input.categoryId) return null;
  try {
    // Reuse an existing (even inactive) match to avoid duplicates.
    const { data: existing } = await db
      .from("expense_subcategories")
      .select("id, name")
      .eq("category_id", input.categoryId)
      .ilike("name", name)
      .is("deleted_at", null)
      .limit(1);
    if (existing && existing.length > 0) {
      return { id: existing[0].id, name: existing[0].name };
    }
    const { data, error } = await db
      .from("expense_subcategories")
      .insert({
        category_id: input.categoryId,
        name,
        is_ai_generated: true,
        is_active: true,
        sort_order: 999,
        created_by: input.createdBy,
      })
      .select("id, name")
      .single();
    if (error || !data) return null;
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}
