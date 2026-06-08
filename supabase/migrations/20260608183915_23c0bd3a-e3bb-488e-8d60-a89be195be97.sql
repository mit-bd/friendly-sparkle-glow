
-- Marketing platforms (admin-managed reference list)
CREATE TABLE public.marketing_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_platforms TO authenticated;
GRANT ALL ON public.marketing_platforms TO service_role;
ALTER TABLE public.marketing_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platforms viewable by authenticated" ON public.marketing_platforms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage platforms" ON public.marketing_platforms
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER trg_platforms_updated BEFORE UPDATE ON public.marketing_platforms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Currencies (admin-managed reference list)
CREATE TABLE public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Currencies viewable by authenticated" ON public.currencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage currencies" ON public.currencies
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Marketing fields on expenses. `amount` remains the converted BDT amount.
ALTER TABLE public.expenses
  ADD COLUMN is_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN platform_id uuid REFERENCES public.marketing_platforms(id) ON DELETE SET NULL,
  ADD COLUMN campaign_name text,
  ADD COLUMN currency text NOT NULL DEFAULT 'BDT',
  ADD COLUMN original_amount numeric(14,2),
  ADD COLUMN exchange_rate numeric(18,6) NOT NULL DEFAULT 1;

CREATE INDEX idx_expenses_marketing ON public.expenses (is_marketing) WHERE is_marketing;
CREATE INDEX idx_expenses_platform ON public.expenses (platform_id);

-- Extend change-tracking to cover marketing fields.
CREATE OR REPLACE FUNCTION public.capture_expense_field_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  lbl text := NEW.expense_number;
  cat_old text; cat_new text; sub_old text; sub_new text;
  plat_old text; plat_new text;
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Amount (BDT)',OLD.amount::text,NEW.amount::text,uid);
  END IF;
  IF NEW.original_amount IS DISTINCT FROM OLD.original_amount THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Original Amount',OLD.original_amount::text,NEW.original_amount::text,uid);
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Currency',OLD.currency,NEW.currency,uid);
  END IF;
  IF NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Exchange Rate',OLD.exchange_rate::text,NEW.exchange_rate::text,uid);
  END IF;
  IF NEW.campaign_name IS DISTINCT FROM OLD.campaign_name THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Campaign',OLD.campaign_name,NEW.campaign_name,uid);
  END IF;
  IF NEW.platform_id IS DISTINCT FROM OLD.platform_id THEN
    SELECT name INTO plat_old FROM public.marketing_platforms WHERE id = OLD.platform_id;
    SELECT name INTO plat_new FROM public.marketing_platforms WHERE id = NEW.platform_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Platform',plat_old,plat_new,uid);
  END IF;
  IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    SELECT name INTO cat_old FROM public.expense_categories WHERE id = OLD.category_id;
    SELECT name INTO cat_new FROM public.expense_categories WHERE id = NEW.category_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Category',cat_old,cat_new,uid);
  END IF;
  IF NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id THEN
    SELECT name INTO sub_old FROM public.expense_subcategories WHERE id = OLD.subcategory_id;
    SELECT name INTO sub_new FROM public.expense_subcategories WHERE id = NEW.subcategory_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Subcategory',sub_old,sub_new,uid);
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Description',OLD.description,NEW.description,uid);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Notes',OLD.notes,NEW.notes,uid);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Status',OLD.status::text,NEW.status::text,uid);
  END IF;
  RETURN NEW;
END; $function$;
