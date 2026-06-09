-- 1. Settlement columns on expenses (only meaningful for fixed-cost rows)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fc_settlement_status text,
  ADD COLUMN IF NOT EXISTS fc_paid_amount numeric NOT NULL DEFAULT 0;

-- Backfill existing fixed-cost records
UPDATE public.expenses SET
  fc_settlement_status = CASE
    WHEN status = 'approved' THEN 'paid'
    WHEN status = 'rejected' THEN 'rejected'
    ELSE 'generated' END,
  fc_paid_amount = CASE WHEN status = 'approved' THEN amount ELSE 0 END
WHERE is_fixed_cost = true AND fc_settlement_status IS NULL;

-- 2. Fixed cost payments table (mirrors payable_payments)
CREATE TABLE public.fixed_cost_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT current_date,
  reference_number text,
  notes text,
  file_path text,
  file_name text,
  mime_type text,
  size_bytes integer,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fixed_cost_payments_expense ON public.fixed_cost_payments(expense_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_cost_payments TO authenticated;
GRANT ALL ON public.fixed_cost_payments TO service_role;

ALTER TABLE public.fixed_cost_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc pay read" ON public.fixed_cost_payments FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'fixed_costs', 'view')
  OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = fixed_cost_payments.expense_id AND e.created_by = auth.uid())
);

CREATE POLICY "fc pay write" ON public.fixed_cost_payments FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'fixed_costs', 'edit')
  OR public.has_permission(auth.uid(), 'fixed_costs', 'approve')
);

CREATE POLICY "fc pay delete" ON public.fixed_cost_payments FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. Allow settlement-driven expense status flips to bypass the approval lock
CREATE OR REPLACE FUNCTION public.enforce_expense_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.fc_settlement', true) = '1' THEN
    RETURN NEW;
  END IF;

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
END; $function$;

-- 4. Settlement recompute trigger
CREATE OR REPLACE FUNCTION public.tg_fixed_cost_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  exp public.expenses;
  v_paid numeric;
  v_status text;
  in_app boolean;
  eid uuid := coalesce(new.expense_id, old.expense_id);
begin
  select coalesce(sum(amount),0) into v_paid from public.fixed_cost_payments where expense_id = eid;
  select * into exp from public.expenses where id = eid;

  if exp.amount > 0 and v_paid >= exp.amount then v_status := 'paid';
  elsif v_paid > 0 then v_status := 'partially_paid';
  else v_status := 'generated';
  end if;

  perform set_config('app.fc_settlement','1', true);

  if v_status = 'paid' then
    update public.expenses
      set fc_paid_amount = v_paid, fc_settlement_status = v_status,
          status = 'approved', approved_at = coalesce(approved_at, now()),
          approved_by = coalesce(approved_by, auth.uid())
      where id = eid;
  else
    update public.expenses
      set fc_paid_amount = v_paid, fc_settlement_status = v_status,
          status = case when status = 'approved' then 'pending_approval'::expense_status else status end,
          approved_at = case when status = 'approved' then null else approved_at end
      where id = eid;
  end if;

  perform set_config('app.fc_settlement','0', true);

  select enabled into in_app from public.notification_settings where channel='in_app';

  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
      values(auth.uid(),'payment_added','fixed_cost',eid,exp.expense_number,
        jsonb_build_object('amount',new.amount,'paid',v_paid,'remaining',greatest(exp.amount - v_paid,0),'settlement',v_status));
    if v_status = 'partially_paid' then
      insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
        values(auth.uid(),'partial_approve','fixed_cost',eid,exp.expense_number,
          jsonb_build_object('paid',v_paid,'total',exp.amount));
    elsif v_status = 'paid' then
      insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
        values(auth.uid(),'full_approve','fixed_cost',eid,exp.expense_number,
          jsonb_build_object('paid',v_paid,'total',exp.amount));
    end if;
    if in_app is true and exp.created_by is not null and exp.created_by <> auth.uid() then
      insert into public.notifications(user_id,type,title,body,expense_id)
        values(exp.created_by,'fixed_cost_'||v_status,
          case v_status when 'paid' then 'Fixed cost fully paid' else 'Fixed cost payment recorded' end,
          exp.expense_number||' — payment of '||new.amount::text||' recorded.', eid);
    end if;
    return new;
  else
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
      values(auth.uid(),'payment_removed','fixed_cost',eid,exp.expense_number,
        jsonb_build_object('amount',old.amount,'paid',v_paid,'settlement',v_status));
    return old;
  end if;
end; $function$;

CREATE TRIGGER trg_fixed_cost_payment
AFTER INSERT OR DELETE ON public.fixed_cost_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_fixed_cost_payment();

-- 5. Generation starts records as "generated", never auto-approved
CREATE OR REPLACE FUNCTION public.generate_fixed_costs(_month date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      status, created_by, is_fixed_cost, fixed_cost_template_id, period_month,
      fc_settlement_status, fc_paid_amount
    ) VALUES (
      m, t.category_id, t.subcategory_id, t.monthly_amount,
      COALESCE(NULLIF(t.description,''), t.name), t.notes,
      'pending_approval', t.created_by, true, t.id, m,
      'generated', 0
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