-- ============================================================
-- MULTI-TENANT ISOLATION: PART A (schema, triggers, backfill)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_company_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT company_id FROM public.profiles WHERE id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END; $$;

-- Add company_id column + index + insert trigger to every tenant table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'expenses','expense_attachments','expense_comments','expense_events',
    'returns','return_attachments','return_events',
    'damages','damage_attachments','damage_events',
    'receivables','receivable_attachments','receivable_collections','receivable_events',
    'payables','payable_attachments','payable_payments','payable_events',
    'fixed_cost_templates','fixed_cost_payments',
    'budgets','budget_alerts',
    'expense_categories','expense_subcategories','damage_types','return_reasons',
    'marketing_platforms','signatories',
    'report_exports','activity_logs','field_changes','notifications',
    'ai_classification_feedback','qa_checklist_items','company_profile'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(company_id)', t||'_company_id_idx', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id()', t);
  END LOOP;
END $$;

-- Backfill existing rows to the original company, bypassing audit/lock triggers
SET session_replication_role = replica;

DO $$
DECLARE
  t text;
  motion uuid := '96b33c06-58aa-4bd9-b137-1182fcd822fd';
  tables text[] := ARRAY[
    'expenses','expense_attachments','expense_comments','expense_events',
    'returns','return_attachments','return_events',
    'damages','damage_attachments','damage_events',
    'receivables','receivable_attachments','receivable_collections','receivable_events',
    'payables','payable_attachments','payable_payments','payable_events',
    'fixed_cost_templates','fixed_cost_payments',
    'budgets','budget_alerts',
    'expense_categories','expense_subcategories','damage_types','return_reasons',
    'marketing_platforms','signatories',
    'report_exports','activity_logs','field_changes','notifications',
    'ai_classification_feedback','qa_checklist_items','company_profile'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, motion);
  END LOOP;
END $$;

UPDATE public.profiles
SET company_id = '96b33c06-58aa-4bd9-b137-1182fcd822fd'
WHERE company_id IS NULL AND NOT public.is_owner(id);

SET session_replication_role = origin;
