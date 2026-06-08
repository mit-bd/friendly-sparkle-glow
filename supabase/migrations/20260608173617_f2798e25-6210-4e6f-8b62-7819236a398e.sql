
-- 1. Audit columns on expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid;

-- 2. Expense discussion thread
CREATE TABLE public.expense_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_comments_expense ON public.expense_comments(expense_id, created_at);
GRANT SELECT, INSERT ON public.expense_comments TO authenticated;
GRANT ALL ON public.expense_comments TO service_role;
ALTER TABLE public.expense_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments select for expense viewers" ON public.expense_comments
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_comments.expense_id
      AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','view') OR e.created_by = auth.uid())
  )
);
CREATE POLICY "Comments insert by author" ON public.expense_comments
FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_comments.expense_id
      AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','view') OR e.created_by = auth.uid())
  )
);

-- 3. Permanent approval / audit history (insert + select only)
CREATE TABLE public.expense_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status public.expense_status,
  to_status public.expense_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_events_expense ON public.expense_events(expense_id, created_at);
GRANT SELECT, INSERT ON public.expense_events TO authenticated;
GRANT ALL ON public.expense_events TO service_role;
ALTER TABLE public.expense_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events select for expense viewers" ON public.expense_events
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_events.expense_id
      AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','view') OR e.created_by = auth.uid())
  )
);
CREATE POLICY "Events insert by actor" ON public.expense_events
FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_events.expense_id
      AND (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','view') OR e.created_by = auth.uid())
  )
);

-- 4. In-app notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications select own" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notifications update own" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Notifications delete own" ON public.notifications
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Audit timestamp trigger
CREATE OR REPLACE FUNCTION public.track_expense_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
      NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      NEW.approved_at := now(); NEW.approved_by := auth.uid();
    ELSIF NEW.status = 'rejected' THEN
      NEW.rejected_at := now(); NEW.rejected_by := auth.uid();
    ELSIF NEW.status IN ('submitted','pending_approval') AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
      NEW.submitted_by := COALESCE(NEW.created_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_track_expense_audit ON public.expenses;
CREATE TRIGGER trg_track_expense_audit
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.track_expense_audit();

-- 6. Replace status-enforcement to add revision + locking
CREATE OR REPLACE FUNCTION public.enforce_expense_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','rejected','revision_requested')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','approve')) THEN
      RAISE EXCEPTION 'Not authorized to approve, reject, or request revision on expenses';
    END IF;
  END IF;

  IF OLD.status = 'approved' THEN
    IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(),'expenses','approve')) THEN
      RAISE EXCEPTION 'Approved expenses are locked and can only be modified by an admin or authorized approver';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- 7. Notification fan-out (respects in-app channel toggle)
CREATE OR REPLACE FUNCTION public.handle_expense_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  in_app_enabled boolean;
  ntype text;
  ntitle text;
  nbody text;
BEGIN
  SELECT enabled INTO in_app_enabled FROM public.notification_settings WHERE channel = 'in_app';
  IF in_app_enabled IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('submitted','pending_approval') THEN
      INSERT INTO public.notifications (user_id, type, title, body, expense_id)
      SELECT DISTINCT ur.user_id, 'expense_submitted', 'New expense submitted',
             NEW.expense_number || ' needs approval.', NEW.id
      FROM public.user_roles ur
      WHERE (ur.role = 'admin' OR public.has_permission(ur.user_id,'expenses','approve'))
        AND ur.user_id <> COALESCE(NEW.created_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN ntype:='expense_approved'; ntitle:='Expense approved';
    ELSIF NEW.status = 'rejected' THEN ntype:='expense_rejected'; ntitle:='Expense rejected';
    ELSIF NEW.status = 'revision_requested' THEN ntype:='expense_revision'; ntitle:='Revision requested';
    ELSIF NEW.status = 'pending_approval' THEN ntype:='expense_pending'; ntitle:='Expense pending approval';
    ELSE ntype:='expense_updated'; ntitle:='Expense updated';
    END IF;
    nbody := NEW.expense_number || ' is now ' || replace(NEW.status::text,'_',' ') || '.';

    -- notify the submitter/creator (not the actor)
    INSERT INTO public.notifications (user_id, type, title, body, expense_id)
    SELECT DISTINCT uid, ntype, ntitle, nbody, NEW.id
    FROM (SELECT unnest(ARRAY[NEW.created_by, NEW.submitted_by]) AS uid) s
    WHERE uid IS NOT NULL AND uid <> auth.uid();

    -- when resubmitted into pending, alert approvers too
    IF NEW.status = 'pending_approval' THEN
      INSERT INTO public.notifications (user_id, type, title, body, expense_id)
      SELECT DISTINCT ur.user_id, 'expense_submitted', 'Expense pending approval',
             NEW.expense_number || ' needs approval.', NEW.id
      FROM public.user_roles ur
      WHERE (ur.role = 'admin' OR public.has_permission(ur.user_id,'expenses','approve'))
        AND ur.user_id <> auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expense_notifications ON public.expenses;
CREATE TRIGGER trg_expense_notifications
AFTER INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_expense_notifications();

-- 8. Lock down the new SECURITY DEFINER trigger funcs from direct API calls
REVOKE EXECUTE ON FUNCTION public.track_expense_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_expense_notifications() FROM PUBLIC, anon, authenticated;

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_events;
