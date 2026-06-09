-- 1. Audit logs: drop manager-by-role bypass
DROP POLICY IF EXISTS "audit logs read" ON public.activity_logs;
CREATE POLICY "audit logs read" ON public.activity_logs
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR has_permission(auth.uid(), 'audit', 'view')
  OR (actor_id = auth.uid())
);

-- 2. Budget alerts: restrict direct inserts
DROP POLICY IF EXISTS "budget_alerts insert" ON public.budget_alerts;
CREATE POLICY "budget_alerts insert" ON public.budget_alerts
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR has_permission(auth.uid(), 'budgets', 'edit')
);

-- 3. Payable events: require finance access to the referenced payable
DROP POLICY IF EXISTS "finance write pevt" ON public.payable_events;
CREATE POLICY "finance write pevt" ON public.payable_events
FOR INSERT TO authenticated
WITH CHECK (
  (actor_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.payables p
    WHERE p.id = payable_events.payable_id
      AND (
        is_admin(auth.uid())
        OR has_permission(auth.uid(), 'finance', 'view')
        OR p.created_by = auth.uid()
      )
  )
);

-- 4. Receivable events: require finance access to the referenced receivable
DROP POLICY IF EXISTS "finance write revt" ON public.receivable_events;
CREATE POLICY "finance write revt" ON public.receivable_events
FOR INSERT TO authenticated
WITH CHECK (
  (actor_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.receivables r
    WHERE r.id = receivable_events.receivable_id
      AND (
        is_admin(auth.uid())
        OR has_permission(auth.uid(), 'finance', 'view')
        OR r.created_by = auth.uid()
      )
  )
);