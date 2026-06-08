-- =========================================================
-- AUDIT TRAIL, ACTIVITY LOG, RECYCLE BIN & CHANGE HISTORY
-- =========================================================

-- 1. SOFT-DELETE COLUMNS -----------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid;

ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid;

ALTER TABLE public.expense_subcategories
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid;

-- 2. ACTIVITY LOG TABLE (immutable) ------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  entity_label text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created  ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor    ON public.activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity   ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action   ON public.activity_logs (action);

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin & manager see all; accountant (audit view perm) sees own; viewer none.
CREATE POLICY "audit logs read" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'manager')
    OR (actor_id = auth.uid() AND public.has_permission(auth.uid(), 'audit', 'view'))
  );
-- No INSERT/UPDATE/DELETE policies: rows are written only by SECURITY DEFINER
-- functions/triggers, making the log effectively immutable for end users.

-- 3. FIELD-LEVEL CHANGE HISTORY (immutable) ----------------
CREATE TABLE IF NOT EXISTS public.field_changes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  entity_label text,
  field        text NOT NULL,
  old_value    text,
  new_value    text,
  changed_by   uuid,
  changed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_changes_entity ON public.field_changes (entity_type, entity_id, changed_at DESC);

GRANT SELECT ON public.field_changes TO authenticated;
GRANT ALL ON public.field_changes TO service_role;
ALTER TABLE public.field_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field changes read" ON public.field_changes
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'manager')
    OR (changed_by = auth.uid() AND public.has_permission(auth.uid(), 'audit', 'view'))
  );

-- 4. CLIENT-CALLABLE ACTIVITY LOGGER -----------------------
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text, _entity_type text, _entity_id uuid,
  _entity_label text, _metadata jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, entity_label, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _entity_label, COALESCE(_metadata, '{}'::jsonb));
END; $$;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb) TO authenticated;

-- 5. EXPENSE SOFT-DELETE MAINTENANCE (BEFORE UPDATE) -------
CREATE OR REPLACE FUNCTION public.maintain_expense_softdelete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    NEW.deleted_at := now(); NEW.deleted_by := auth.uid();
    NEW.restored_at := NULL; NEW.restored_by := NULL;
  ELSIF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM 'deleted' THEN
    NEW.restored_at := now(); NEW.restored_by := auth.uid();
    NEW.deleted_at := NULL; NEW.deleted_by := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_expenses_softdelete ON public.expenses;
CREATE TRIGGER trg_expenses_softdelete
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.maintain_expense_softdelete();

-- 6. EXPENSE FIELD-CHANGE CAPTURE (AFTER UPDATE) -----------
CREATE OR REPLACE FUNCTION public.capture_expense_field_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  lbl text := NEW.expense_number;
  cat_old text; cat_new text; sub_old text; sub_new text;
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('expense',NEW.id,lbl,'Amount',OLD.amount::text,NEW.amount::text,uid);
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
END; $$;
DROP TRIGGER IF EXISTS trg_expenses_field_changes ON public.expenses;
CREATE TRIGGER trg_expenses_field_changes
  AFTER UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.capture_expense_field_changes();

-- 7. EXPENSE ACTIVITY LOG (AFTER INSERT/UPDATE) ------------
CREATE OR REPLACE FUNCTION public.log_expense_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (COALESCE(NEW.created_by, auth.uid()),'create','expense',NEW.id,NEW.expense_number,
            jsonb_build_object('amount',NEW.amount,'status',NEW.status));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    act := CASE NEW.status
      WHEN 'approved' THEN 'approve'
      WHEN 'rejected' THEN 'reject'
      WHEN 'revision_requested' THEN 'revision_request'
      WHEN 'deleted' THEN 'delete'
      ELSE CASE WHEN OLD.status = 'deleted' THEN 'restore' ELSE 'update' END
    END;
  ELSE
    act := 'update';
  END IF;

  INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
  VALUES (auth.uid(),act,'expense',NEW.id,NEW.expense_number,
          jsonb_build_object('from_status',OLD.status,'to_status',NEW.status));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_expenses_activity ON public.expenses;
CREATE TRIGGER trg_expenses_activity
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_activity();

-- 8. ATTACHMENT ACTIVITY + TIMELINE EVENTS -----------------
CREATE OR REPLACE FUNCTION public.log_attachment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE enum text; eid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT expense_number INTO enum FROM public.expenses WHERE id = NEW.expense_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'create','attachment',NEW.expense_id,enum,
            jsonb_build_object('file_name',NEW.file_name));
    INSERT INTO public.expense_events(expense_id,actor_id,action,notes)
    VALUES (NEW.expense_id,auth.uid(),'attachment_added',COALESCE(NEW.file_name,'Attachment'));
    RETURN NEW;
  ELSE
    SELECT expense_number INTO enum FROM public.expenses WHERE id = OLD.expense_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'delete','attachment',OLD.expense_id,enum,
            jsonb_build_object('file_name',OLD.file_name));
    INSERT INTO public.expense_events(expense_id,actor_id,action,notes)
    VALUES (OLD.expense_id,auth.uid(),'attachment_removed',COALESCE(OLD.file_name,'Attachment'));
    RETURN OLD;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_attachment_activity ON public.expense_attachments;
CREATE TRIGGER trg_attachment_activity
  AFTER INSERT OR DELETE ON public.expense_attachments
  FOR EACH ROW EXECUTE FUNCTION public.log_attachment_activity();

-- 9. CATEGORY / SUBCATEGORY SOFT-DELETE + ACTIVITY ---------
CREATE OR REPLACE FUNCTION public.log_taxonomy_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE etype text := CASE TG_TABLE_NAME WHEN 'expense_categories' THEN 'category' ELSE 'subcategory' END;
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label)
    VALUES (auth.uid(),'create',etype,NEW.id,NEW.name);
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN act := 'delete';
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN act := 'restore';
  ELSE act := 'update';
  END IF;
  INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
  VALUES (auth.uid(),act,etype,NEW.id,NEW.name,jsonb_build_object('is_active',NEW.is_active));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_categories_activity ON public.expense_categories;
CREATE TRIGGER trg_categories_activity
  AFTER INSERT OR UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_taxonomy_activity();
DROP TRIGGER IF EXISTS trg_subcategories_activity ON public.expense_subcategories;
CREATE TRIGGER trg_subcategories_activity
  AFTER INSERT OR UPDATE ON public.expense_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.log_taxonomy_activity();

-- 10. AUDIT MODULE PERMISSIONS -----------------------------
INSERT INTO public.role_permissions (role, module, can_view, can_edit, can_approve, can_export)
VALUES
  ('admin','audit',      true,  true,  true,  true),
  ('manager','audit',    true,  false, false, false),
  ('accountant','audit', true,  false, false, false),
  ('viewer','audit',     false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;