
-- =====================================================================
-- RETURNS, DAMAGES & LOSS MANAGEMENT  (reuses expense_status enum)
-- =====================================================================

-- ---------- Reference tables --------------------------------------------------
CREATE TABLE public.return_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_reasons TO authenticated;
GRANT ALL ON public.return_reasons TO service_role;
ALTER TABLE public.return_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Return reasons readable" ON public.return_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Return reasons admin manage" ON public.return_reasons FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.damage_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_types TO authenticated;
GRANT ALL ON public.damage_types TO service_role;
ALTER TABLE public.damage_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Damage types readable" ON public.damage_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Damage types admin manage" ON public.damage_types FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- Counters ----------------------------------------------------------
CREATE TABLE public.return_counters (year integer PRIMARY KEY, last_seq integer NOT NULL DEFAULT 0);
CREATE TABLE public.damage_counters (year integer PRIMARY KEY, last_seq integer NOT NULL DEFAULT 0);
GRANT ALL ON public.return_counters TO service_role;
GRANT ALL ON public.damage_counters TO service_role;
ALTER TABLE public.return_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_counters ENABLE ROW LEVEL SECURITY;

-- ---------- Returns -----------------------------------------------------------
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  reason_id uuid REFERENCES public.return_reasons(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  customer_notes text,
  loss_amount numeric(14,2) NOT NULL DEFAULT 0,
  recoverable_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_loss_amount numeric(14,2) GENERATED ALWAYS AS (loss_amount - recoverable_amount) STORED,
  notes text,
  status public.expense_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz, submitted_by uuid,
  approved_at timestamptz, approved_by uuid,
  rejected_at timestamptz, rejected_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  restored_at timestamptz, restored_by uuid
);
CREATE INDEX idx_returns_status ON public.returns(status);
CREATE INDEX idx_returns_date ON public.returns(return_date);
CREATE INDEX idx_returns_reason ON public.returns(reason_id);
CREATE INDEX idx_returns_created_by ON public.returns(created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Returns select" ON public.returns FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','view') OR created_by = auth.uid());
CREATE POLICY "Returns insert" ON public.returns FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','edit')));
CREATE POLICY "Returns update" ON public.returns FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (created_by = auth.uid() AND public.has_permission(auth.uid(),'returns','edit')) OR public.has_permission(auth.uid(),'returns','approve'))
  WITH CHECK (public.is_admin(auth.uid()) OR (created_by = auth.uid() AND public.has_permission(auth.uid(),'returns','edit')) OR public.has_permission(auth.uid(),'returns','approve'));
CREATE POLICY "Returns delete" ON public.returns FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ---------- Damages -----------------------------------------------------------
CREATE TABLE public.damages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_number text NOT NULL UNIQUE,
  damage_date date NOT NULL DEFAULT CURRENT_DATE,
  type_id uuid REFERENCES public.damage_types(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  damage_value numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  status public.expense_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz, submitted_by uuid,
  approved_at timestamptz, approved_by uuid,
  rejected_at timestamptz, rejected_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  restored_at timestamptz, restored_by uuid
);
CREATE INDEX idx_damages_status ON public.damages(status);
CREATE INDEX idx_damages_date ON public.damages(damage_date);
CREATE INDEX idx_damages_type ON public.damages(type_id);
CREATE INDEX idx_damages_created_by ON public.damages(created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damages TO authenticated;
GRANT ALL ON public.damages TO service_role;
ALTER TABLE public.damages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Damages select" ON public.damages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','view') OR created_by = auth.uid());
CREATE POLICY "Damages insert" ON public.damages FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','edit')));
CREATE POLICY "Damages update" ON public.damages FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (created_by = auth.uid() AND public.has_permission(auth.uid(),'damages','edit')) OR public.has_permission(auth.uid(),'damages','approve'))
  WITH CHECK (public.is_admin(auth.uid()) OR (created_by = auth.uid() AND public.has_permission(auth.uid(),'damages','edit')) OR public.has_permission(auth.uid(),'damages','approve'));
CREATE POLICY "Damages delete" ON public.damages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ---------- Attachments -------------------------------------------------------
CREATE TABLE public.return_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_attachments TO authenticated;
GRANT ALL ON public.return_attachments TO service_role;
ALTER TABLE public.return_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Return att select" ON public.return_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','view') OR r.created_by = auth.uid())));
CREATE POLICY "Return att insert" ON public.return_attachments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_id
    AND (public.is_admin(auth.uid()) OR (r.created_by = auth.uid() AND public.has_permission(auth.uid(),'returns','edit')) OR public.has_permission(auth.uid(),'returns','approve'))));
CREATE POLICY "Return att delete" ON public.return_attachments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE TABLE public.damage_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_id uuid NOT NULL REFERENCES public.damages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_attachments TO authenticated;
GRANT ALL ON public.damage_attachments TO service_role;
ALTER TABLE public.damage_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Damage att select" ON public.damage_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.damages d WHERE d.id = damage_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','view') OR d.created_by = auth.uid())));
CREATE POLICY "Damage att insert" ON public.damage_attachments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.damages d WHERE d.id = damage_id
    AND (public.is_admin(auth.uid()) OR (d.created_by = auth.uid() AND public.has_permission(auth.uid(),'damages','edit')) OR public.has_permission(auth.uid(),'damages','approve'))));
CREATE POLICY "Damage att delete" ON public.damage_attachments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ---------- Approval / history events ----------------------------------------
CREATE TABLE public.return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status public.expense_status,
  to_status public.expense_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_events TO authenticated;
GRANT ALL ON public.return_events TO service_role;
ALTER TABLE public.return_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Return events select" ON public.return_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','view') OR r.created_by = auth.uid())));
CREATE POLICY "Return events insert" ON public.return_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.returns r WHERE r.id = return_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','view') OR r.created_by = auth.uid())));

CREATE TABLE public.damage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_id uuid NOT NULL REFERENCES public.damages(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status public.expense_status,
  to_status public.expense_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_events TO authenticated;
GRANT ALL ON public.damage_events TO service_role;
ALTER TABLE public.damage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Damage events select" ON public.damage_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.damages d WHERE d.id = damage_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','view') OR d.created_by = auth.uid())));
CREATE POLICY "Damage events insert" ON public.damage_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.damages d WHERE d.id = damage_id
    AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','view') OR d.created_by = auth.uid())));

-- ---------- Notifications linkage --------------------------------------------
ALTER TABLE public.notifications ADD COLUMN return_id uuid REFERENCES public.returns(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN damage_id uuid REFERENCES public.damages(id) ON DELETE CASCADE;

-- =====================================================================
-- FUNCTIONS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.next_return_number() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE y integer := EXTRACT(YEAR FROM now())::integer; seq integer;
BEGIN
  INSERT INTO public.return_counters(year,last_seq) VALUES(y,1)
  ON CONFLICT(year) DO UPDATE SET last_seq = public.return_counters.last_seq+1
  RETURNING last_seq INTO seq;
  RETURN 'RET-'||y::text||'-'||lpad(seq::text,6,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.next_damage_number() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE y integer := EXTRACT(YEAR FROM now())::integer; seq integer;
BEGIN
  INSERT INTO public.damage_counters(year,last_seq) VALUES(y,1)
  ON CONFLICT(year) DO UPDATE SET last_seq = public.damage_counters.last_seq+1
  RETURNING last_seq INTO seq;
  RETURN 'DMG-'||y::text||'-'||lpad(seq::text,6,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_return_meta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN NEW.return_number := public.next_return_number(); END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_damage_meta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.damage_number IS NULL OR NEW.damage_number = '' THEN NEW.damage_number := public.next_damage_number(); END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.track_return_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now(); NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN NEW.approved_at := now(); NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'rejected' THEN NEW.rejected_at := now(); NEW.rejected_by := auth.uid();
    ELSIF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now(); NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.track_damage_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now(); NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN NEW.approved_at := now(); NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'rejected' THEN NEW.rejected_at := now(); NEW.rejected_by := auth.uid();
    ELSIF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now(); NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_return_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('approved','rejected','revision_requested') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','approve')) THEN
      RAISE EXCEPTION 'Not authorized to approve, reject, or request revision on returns';
    END IF;
  END IF;
  IF OLD.status = 'approved' THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'returns','approve')) THEN
      RAISE EXCEPTION 'Approved returns are locked and can only be modified by an admin or authorized approver';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_damage_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('approved','rejected','revision_requested') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','approve')) THEN
      RAISE EXCEPTION 'Not authorized to approve, reject, or request revision on damages';
    END IF;
  END IF;
  IF OLD.status = 'approved' THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'damages','approve')) THEN
      RAISE EXCEPTION 'Approved damages are locked and can only be modified by an admin or authorized approver';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.maintain_return_softdelete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    NEW.deleted_at := now(); NEW.deleted_by := auth.uid(); NEW.restored_at := NULL; NEW.restored_by := NULL;
  ELSIF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM 'deleted' THEN
    NEW.restored_at := now(); NEW.restored_by := auth.uid(); NEW.deleted_at := NULL; NEW.deleted_by := NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.maintain_damage_softdelete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    NEW.deleted_at := now(); NEW.deleted_by := auth.uid(); NEW.restored_at := NULL; NEW.restored_by := NULL;
  ELSIF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM 'deleted' THEN
    NEW.restored_at := now(); NEW.restored_by := auth.uid(); NEW.deleted_at := NULL; NEW.deleted_by := NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_return_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (COALESCE(NEW.created_by,auth.uid()),'create','return',NEW.id,NEW.return_number,
            jsonb_build_object('net_loss',NEW.net_loss_amount,'status',NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    act := CASE NEW.status
      WHEN 'approved' THEN 'approve' WHEN 'rejected' THEN 'reject'
      WHEN 'revision_requested' THEN 'revision_request' WHEN 'deleted' THEN 'delete'
      ELSE CASE WHEN OLD.status='deleted' THEN 'restore' ELSE 'update' END END;
  ELSE act := 'update'; END IF;
  INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
  VALUES (auth.uid(),act,'return',NEW.id,NEW.return_number,
          jsonb_build_object('from_status',OLD.status,'to_status',NEW.status));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_damage_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (COALESCE(NEW.created_by,auth.uid()),'create','damage',NEW.id,NEW.damage_number,
            jsonb_build_object('value',NEW.damage_value,'status',NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    act := CASE NEW.status
      WHEN 'approved' THEN 'approve' WHEN 'rejected' THEN 'reject'
      WHEN 'revision_requested' THEN 'revision_request' WHEN 'deleted' THEN 'delete'
      ELSE CASE WHEN OLD.status='deleted' THEN 'restore' ELSE 'update' END END;
  ELSE act := 'update'; END IF;
  INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
  VALUES (auth.uid(),act,'damage',NEW.id,NEW.damage_number,
          jsonb_build_object('from_status',OLD.status,'to_status',NEW.status));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.capture_return_field_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); lbl text := NEW.return_number;
  cat_old text; cat_new text; rs_old text; rs_new text;
BEGIN
  IF NEW.product_name IS DISTINCT FROM OLD.product_name THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Product',OLD.product_name,NEW.product_name,uid); END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Quantity',OLD.quantity::text,NEW.quantity::text,uid); END IF;
  IF NEW.loss_amount IS DISTINCT FROM OLD.loss_amount THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Loss Amount',OLD.loss_amount::text,NEW.loss_amount::text,uid); END IF;
  IF NEW.recoverable_amount IS DISTINCT FROM OLD.recoverable_amount THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Recoverable Amount',OLD.recoverable_amount::text,NEW.recoverable_amount::text,uid); END IF;
  IF NEW.reason_id IS DISTINCT FROM OLD.reason_id THEN
    SELECT name INTO rs_old FROM public.return_reasons WHERE id = OLD.reason_id;
    SELECT name INTO rs_new FROM public.return_reasons WHERE id = NEW.reason_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Reason',rs_old,rs_new,uid); END IF;
  IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    SELECT name INTO cat_old FROM public.expense_categories WHERE id = OLD.category_id;
    SELECT name INTO cat_new FROM public.expense_categories WHERE id = NEW.category_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Category',cat_old,cat_new,uid); END IF;
  IF NEW.customer_notes IS DISTINCT FROM OLD.customer_notes THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Customer Notes',OLD.customer_notes,NEW.customer_notes,uid); END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Notes',OLD.notes,NEW.notes,uid); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('return',NEW.id,lbl,'Status',OLD.status::text,NEW.status::text,uid); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.capture_damage_field_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); lbl text := NEW.damage_number; t_old text; t_new text;
BEGIN
  IF NEW.product_name IS DISTINCT FROM OLD.product_name THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Product',OLD.product_name,NEW.product_name,uid); END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Quantity',OLD.quantity::text,NEW.quantity::text,uid); END IF;
  IF NEW.damage_value IS DISTINCT FROM OLD.damage_value THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Damage Value',OLD.damage_value::text,NEW.damage_value::text,uid); END IF;
  IF NEW.type_id IS DISTINCT FROM OLD.type_id THEN
    SELECT name INTO t_old FROM public.damage_types WHERE id = OLD.type_id;
    SELECT name INTO t_new FROM public.damage_types WHERE id = NEW.type_id;
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Damage Type',t_old,t_new,uid); END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Notes',OLD.notes,NEW.notes,uid); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by)
    VALUES ('damage',NEW.id,lbl,'Status',OLD.status::text,NEW.status::text,uid); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_return_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE in_app boolean; ntype text; ntitle text; nbody text;
BEGIN
  SELECT enabled INTO in_app FROM public.notification_settings WHERE channel='in_app';
  IF in_app IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') THEN
      INSERT INTO public.notifications(user_id,type,title,body,return_id)
      SELECT DISTINCT ur.user_id,'return_submitted','New return submitted',NEW.return_number||' needs approval.',NEW.id
      FROM public.user_roles ur
      WHERE (ur.role='admin' OR public.has_permission(ur.user_id,'returns','approve'))
        AND ur.user_id <> COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='approved' THEN ntype:='return_approved'; ntitle:='Return approved';
    ELSIF NEW.status='rejected' THEN ntype:='return_rejected'; ntitle:='Return rejected';
    ELSIF NEW.status='revision_requested' THEN ntype:='return_revision'; ntitle:='Revision requested';
    ELSIF NEW.status='pending_approval' THEN ntype:='return_pending'; ntitle:='Return pending approval';
    ELSE ntype:='return_updated'; ntitle:='Return updated'; END IF;
    nbody := NEW.return_number||' is now '||replace(NEW.status::text,'_',' ')||'.';
    INSERT INTO public.notifications(user_id,type,title,body,return_id)
    SELECT DISTINCT uid,ntype,ntitle,nbody,NEW.id
    FROM (SELECT unnest(ARRAY[NEW.created_by,NEW.submitted_by]) AS uid) s
    WHERE uid IS NOT NULL AND uid <> auth.uid();
    IF NEW.status='pending_approval' THEN
      INSERT INTO public.notifications(user_id,type,title,body,return_id)
      SELECT DISTINCT ur.user_id,'return_submitted','Return pending approval',NEW.return_number||' needs approval.',NEW.id
      FROM public.user_roles ur
      WHERE (ur.role='admin' OR public.has_permission(ur.user_id,'returns','approve')) AND ur.user_id <> auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_damage_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE in_app boolean; ntype text; ntitle text; nbody text;
BEGIN
  SELECT enabled INTO in_app FROM public.notification_settings WHERE channel='in_app';
  IF in_app IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') THEN
      INSERT INTO public.notifications(user_id,type,title,body,damage_id)
      SELECT DISTINCT ur.user_id,'damage_submitted','New damage submitted',NEW.damage_number||' needs approval.',NEW.id
      FROM public.user_roles ur
      WHERE (ur.role='admin' OR public.has_permission(ur.user_id,'damages','approve'))
        AND ur.user_id <> COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='approved' THEN ntype:='damage_approved'; ntitle:='Damage approved';
    ELSIF NEW.status='rejected' THEN ntype:='damage_rejected'; ntitle:='Damage rejected';
    ELSIF NEW.status='revision_requested' THEN ntype:='damage_revision'; ntitle:='Revision requested';
    ELSIF NEW.status='pending_approval' THEN ntype:='damage_pending'; ntitle:='Damage pending approval';
    ELSE ntype:='damage_updated'; ntitle:='Damage updated'; END IF;
    nbody := NEW.damage_number||' is now '||replace(NEW.status::text,'_',' ')||'.';
    INSERT INTO public.notifications(user_id,type,title,body,damage_id)
    SELECT DISTINCT uid,ntype,ntitle,nbody,NEW.id
    FROM (SELECT unnest(ARRAY[NEW.created_by,NEW.submitted_by]) AS uid) s
    WHERE uid IS NOT NULL AND uid <> auth.uid();
    IF NEW.status='pending_approval' THEN
      INSERT INTO public.notifications(user_id,type,title,body,damage_id)
      SELECT DISTINCT ur.user_id,'damage_submitted','Damage pending approval',NEW.damage_number||' needs approval.',NEW.id
      FROM public.user_roles ur
      WHERE (ur.role='admin' OR public.has_permission(ur.user_id,'damages','approve')) AND ur.user_id <> auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_return_attachment_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rnum text;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT return_number INTO rnum FROM public.returns WHERE id = NEW.return_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'create','return_attachment',NEW.return_id,rnum,jsonb_build_object('file_name',NEW.file_name));
    INSERT INTO public.return_events(return_id,actor_id,action,notes)
    VALUES (NEW.return_id,auth.uid(),'attachment_added',COALESCE(NEW.file_name,'Attachment'));
    RETURN NEW;
  ELSE
    SELECT return_number INTO rnum FROM public.returns WHERE id = OLD.return_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'delete','return_attachment',OLD.return_id,rnum,jsonb_build_object('file_name',OLD.file_name));
    INSERT INTO public.return_events(return_id,actor_id,action,notes)
    VALUES (OLD.return_id,auth.uid(),'attachment_removed',COALESCE(OLD.file_name,'Attachment'));
    RETURN OLD;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.log_damage_attachment_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE dnum text;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT damage_number INTO dnum FROM public.damages WHERE id = NEW.damage_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'create','damage_attachment',NEW.damage_id,dnum,jsonb_build_object('file_name',NEW.file_name));
    INSERT INTO public.damage_events(damage_id,actor_id,action,notes)
    VALUES (NEW.damage_id,auth.uid(),'attachment_added',COALESCE(NEW.file_name,'Attachment'));
    RETURN NEW;
  ELSE
    SELECT damage_number INTO dnum FROM public.damages WHERE id = OLD.damage_id;
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    VALUES (auth.uid(),'delete','damage_attachment',OLD.damage_id,dnum,jsonb_build_object('file_name',OLD.file_name));
    INSERT INTO public.damage_events(damage_id,actor_id,action,notes)
    VALUES (OLD.damage_id,auth.uid(),'attachment_removed',COALESCE(OLD.file_name,'Attachment'));
    RETURN OLD;
  END IF;
END; $$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================
CREATE TRIGGER trg_return_meta BEFORE INSERT ON public.returns FOR EACH ROW EXECUTE FUNCTION public.set_return_meta();
CREATE TRIGGER trg_return_track BEFORE INSERT OR UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.track_return_audit();
CREATE TRIGGER trg_return_status BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.enforce_return_status();
CREATE TRIGGER trg_return_softdelete BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.maintain_return_softdelete();
CREATE TRIGGER trg_return_updated BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_return_activity AFTER INSERT OR UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.log_return_activity();
CREATE TRIGGER trg_return_field_changes AFTER UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.capture_return_field_changes();
CREATE TRIGGER trg_return_notifications AFTER INSERT OR UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.handle_return_notifications();
CREATE TRIGGER trg_return_att_activity AFTER INSERT OR DELETE ON public.return_attachments FOR EACH ROW EXECUTE FUNCTION public.log_return_attachment_activity();

CREATE TRIGGER trg_damage_meta BEFORE INSERT ON public.damages FOR EACH ROW EXECUTE FUNCTION public.set_damage_meta();
CREATE TRIGGER trg_damage_track BEFORE INSERT OR UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.track_damage_audit();
CREATE TRIGGER trg_damage_status BEFORE UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.enforce_damage_status();
CREATE TRIGGER trg_damage_softdelete BEFORE UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.maintain_damage_softdelete();
CREATE TRIGGER trg_damage_updated BEFORE UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_damage_activity AFTER INSERT OR UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.log_damage_activity();
CREATE TRIGGER trg_damage_field_changes AFTER UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.capture_damage_field_changes();
CREATE TRIGGER trg_damage_notifications AFTER INSERT OR UPDATE ON public.damages FOR EACH ROW EXECUTE FUNCTION public.handle_damage_notifications();
CREATE TRIGGER trg_damage_att_activity AFTER INSERT OR DELETE ON public.damage_attachments FOR EACH ROW EXECUTE FUNCTION public.log_damage_attachment_activity();

CREATE TRIGGER trg_return_reasons_updated BEFORE UPDATE ON public.return_reasons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_damage_types_updated BEFORE UPDATE ON public.damage_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- SEED DEFAULTS
-- =====================================================================
INSERT INTO public.return_reasons(name,sort_order) VALUES
  ('Customer Refused',0),('Courier Return',1),('Wrong Product',2),
  ('Damaged Product',3),('Customer Complaint',4),('Other',5);
INSERT INTO public.damage_types(name,sort_order) VALUES
  ('Warehouse Damage',0),('Courier Damage',1),('Manufacturing Defect',2),
  ('Lost Product',3),('Broken Product',4),('Water Damage',5),('Other',6);
