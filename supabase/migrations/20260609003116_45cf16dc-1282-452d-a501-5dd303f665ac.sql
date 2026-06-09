
CREATE TABLE public.fixed_cost_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.expense_subcategories(id) ON DELETE SET NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  description text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  auto_generate boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_cost_templates TO authenticated;
GRANT ALL ON public.fixed_cost_templates TO service_role;

ALTER TABLE public.fixed_cost_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fixed cost templates select" ON public.fixed_cost_templates
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'fixed_costs','view'));

CREATE POLICY "Fixed cost templates insert" ON public.fixed_cost_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'fixed_costs','edit'));

CREATE POLICY "Fixed cost templates update" ON public.fixed_cost_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'fixed_costs','edit'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'fixed_costs','edit'));

CREATE POLICY "Fixed cost templates delete" ON public.fixed_cost_templates
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_fixed_cost_templates_updated
  BEFORE UPDATE ON public.fixed_cost_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_fixed_cost_meta()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_fixed_cost_meta
  BEFORE INSERT ON public.fixed_cost_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_fixed_cost_meta();

CREATE OR REPLACE FUNCTION public.log_fixed_cost_activity()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (COALESCE(NEW.created_by, auth.uid()),'create','fixed_cost',NEW.id,NEW.name,
            jsonb_build_object('amount',NEW.monthly_amount,'is_active',NEW.is_active,'auto_generate',NEW.auto_generate));
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN act := 'delete';
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN act := 'restore';
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN act := CASE WHEN NEW.is_active THEN 'enable' ELSE 'disable' END;
  ELSE act := 'update';
  END IF;
  INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
  VALUES (auth.uid(),act,'fixed_cost',NEW.id,NEW.name,
          jsonb_build_object('is_active',NEW.is_active,'auto_generate',NEW.auto_generate,'amount',NEW.monthly_amount));
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_fixed_cost_activity
  AFTER INSERT OR UPDATE ON public.fixed_cost_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_fixed_cost_activity();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_fixed_cost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_cost_template_id uuid REFERENCES public.fixed_cost_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_month date;

CREATE INDEX IF NOT EXISTS idx_expenses_fixed_cost ON public.expenses (is_fixed_cost, period_month);

CREATE OR REPLACE FUNCTION public.generate_fixed_costs(_month date DEFAULT (date_trunc('month', now())::date))
  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  m date := date_trunc('month', _month)::date;
  cnt integer := 0;
  t record;
BEGIN
  FOR t IN
    SELECT * FROM public.fixed_cost_templates
    WHERE is_active = true AND auto_generate = true AND deleted_at IS NULL
      AND effective_from <= (m + interval '1 month' - interval '1 day')::date
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.expenses
      WHERE is_fixed_cost = true AND fixed_cost_template_id = t.id AND period_month = m
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.expenses (
      expense_date, category_id, subcategory_id, amount, description, notes,
      status, created_by, is_fixed_cost, fixed_cost_template_id, period_month
    ) VALUES (
      m, t.category_id, t.subcategory_id, t.monthly_amount,
      COALESCE(NULLIF(t.description,''), t.name), t.notes,
      'pending_approval', t.created_by, true, t.id, m
    );
    cnt := cnt + 1;
  END LOOP;
  IF cnt > 0 THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'generate','fixed_cost',NULL,'Fixed costs '||to_char(m,'Mon YYYY'),
            jsonb_build_object('count',cnt,'month',to_char(m,'YYYY-MM')));
  END IF;
  RETURN cnt;
END; $function$;

GRANT EXECUTE ON FUNCTION public.generate_fixed_costs(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_fixed_costs(date) TO service_role;
