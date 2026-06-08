-- ============================================================
-- ENUM: expense status lifecycle
-- ============================================================
CREATE TYPE public.expense_status AS ENUM (
  'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'deleted'
);

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by authenticated" ON public.expense_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.expense_categories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- EXPENSE SUBCATEGORIES
-- ============================================================
CREATE TABLE public.expense_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_subcategories TO authenticated;
GRANT ALL ON public.expense_subcategories TO service_role;
ALTER TABLE public.expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subcategories_category ON public.expense_subcategories(category_id);

CREATE POLICY "Subcategories viewable by authenticated" ON public.expense_subcategories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subcategories" ON public.expense_subcategories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- EXPENSE NUMBERING (race-safe, unique forever, yearly reset)
-- ============================================================
CREATE TABLE public.expense_counters (
  year INTEGER NOT NULL PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.expense_counters TO authenticated;
GRANT ALL ON public.expense_counters TO service_role;
ALTER TABLE public.expense_counters ENABLE ROW LEVEL SECURITY;
-- no policies: only reachable via SECURITY DEFINER function

CREATE OR REPLACE FUNCTION public.next_expense_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  seq INTEGER;
BEGIN
  INSERT INTO public.expense_counters (year, last_seq)
  VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = public.expense_counters.last_seq + 1
  RETURNING last_seq INTO seq;
  RETURN 'EXP-' || y::TEXT || '-' || lpad(seq::TEXT, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_expense_number() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_number TEXT NOT NULL UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.expense_subcategories(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  notes TEXT,
  status public.expense_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expenses_category ON public.expenses(category_id);
CREATE INDEX idx_expenses_subcategory ON public.expenses(subcategory_id);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

-- SELECT: admins + viewers (view permission) see all; creators see own
CREATE POLICY "Expenses select" ON public.expenses
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'expenses', 'view')
    OR created_by = auth.uid()
  );

-- INSERT: must own the row and have edit permission (or admin)
CREATE POLICY "Expenses insert" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'expenses', 'edit'))
  );

-- UPDATE: admins any; creators with edit permission their own
CREATE POLICY "Expenses update" ON public.expenses
  FOR UPDATE TO authenticated USING (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND public.has_permission(auth.uid(), 'expenses', 'edit'))
  ) WITH CHECK (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND public.has_permission(auth.uid(), 'expenses', 'edit'))
  );

-- DELETE (hard): admins only (normal flow uses Deleted status)
CREATE POLICY "Expenses delete" ON public.expenses
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Auto-number + stamp creator on insert
CREATE OR REPLACE FUNCTION public.set_expense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expense_number IS NULL OR NEW.expense_number = '' THEN
    NEW.expense_number := public.next_expense_number();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_expense_number BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_number();

-- Stamp updated_by / updated_at on update
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce approval authority on status transitions to approved/rejected
CREATE OR REPLACE FUNCTION public.enforce_expense_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'expenses', 'approve')) THEN
      RAISE EXCEPTION 'Not authorized to approve or reject expenses';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_expense_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_expense_status BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_status();

-- ============================================================
-- EXPENSE ATTACHMENTS (multiple-ready)
-- ============================================================
CREATE TABLE public.expense_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_attachments TO authenticated;
GRANT ALL ON public.expense_attachments TO service_role;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attachments_expense ON public.expense_attachments(expense_id);

-- Attachments follow the visibility of their parent expense
CREATE POLICY "Attachments select" ON public.expense_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND (
          public.is_admin(auth.uid())
          OR public.has_permission(auth.uid(), 'expenses', 'view')
          OR e.created_by = auth.uid()
        )
    )
  );

CREATE POLICY "Attachments insert" ON public.expense_attachments
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND (public.is_admin(auth.uid()) OR e.created_by = auth.uid())
    )
  );

CREATE POLICY "Attachments delete" ON public.expense_attachments
  FOR DELETE TO authenticated USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- STORAGE POLICIES: expense-attachments bucket
-- Path convention: "<auth.uid()>/<expense_id>/<file>"
-- ============================================================
CREATE POLICY "Read expense attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'expense-attachments');

CREATE POLICY "Write own expense attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'expense-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Update own expense attachments" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'expense-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  ) WITH CHECK (
    bucket_id = 'expense-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Delete own expense attachments" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'expense-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

-- ============================================================
-- SEED DEFAULT CATEGORIES + SUBCATEGORIES
-- ============================================================
DO $seed$
DECLARE
  cat_id UUID;
BEGIN
  -- 1. Fixed Cost
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Fixed Cost', 1) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Employee Salary', 1), (cat_id, 'Office Rent', 2), (cat_id, 'Warehouse Rent', 3),
    (cat_id, 'Internet Bill', 4), (cat_id, 'Water Bill', 5);

  -- 2. Utility Cost
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Utility Cost', 2) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Electricity Bill', 1), (cat_id, 'Mobile Bill', 2), (cat_id, 'IP PBX Bill', 3);

  -- 3. Office Maintenance
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Office Maintenance', 3) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Tissue', 1), (cat_id, 'Harpic', 2), (cat_id, 'Soap', 3),
    (cat_id, 'Lysol', 4), (cat_id, 'Stationery', 5);

  -- 4. Employee Welfare
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Employee Welfare', 4) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Breakfast', 1), (cat_id, 'Tea', 2), (cat_id, 'Coffee', 3),
    (cat_id, 'Lunch', 4), (cat_id, 'Snacks', 5);

  -- 5. Guest Hospitality
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Guest Hospitality', 5) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Guest Lunch', 1), (cat_id, 'Guest Dinner', 2), (cat_id, 'Meeting Refreshments', 3);

  -- 6. Marketing Cost
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Marketing Cost', 6) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Facebook Ads', 1), (cat_id, 'Google Ads', 2), (cat_id, 'TikTok Ads', 3),
    (cat_id, 'Influencer Marketing', 4);

  -- 7. Logistics Cost
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Logistics Cost', 7) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Delivery Charge', 1), (cat_id, 'COD Charge', 2), (cat_id, 'Courier Charge', 3);

  -- 8. Product Cost
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Product Cost', 8) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Product Purchase', 1), (cat_id, 'Carton', 2), (cat_id, 'Label', 3),
    (cat_id, 'Shrink Poly', 4), (cat_id, 'Packaging Materials', 5);

  -- 9. Loss & Adjustment
  INSERT INTO public.expense_categories (name, sort_order) VALUES ('Loss & Adjustment', 9) RETURNING id INTO cat_id;
  INSERT INTO public.expense_subcategories (category_id, name, sort_order) VALUES
    (cat_id, 'Product Return', 1), (cat_id, 'Damage Cost', 2), (cat_id, 'Refund Loss', 3);
END
$seed$;

-- Keep updated_at fresh on category / subcategory edits
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subcategories_updated BEFORE UPDATE ON public.expense_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();