DROP POLICY IF EXISTS "Expenses update" ON public.expenses;

CREATE POLICY "Expenses update" ON public.expenses
  FOR UPDATE TO authenticated USING (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND public.has_permission(auth.uid(), 'expenses', 'edit'))
    OR public.has_permission(auth.uid(), 'expenses', 'approve')
  ) WITH CHECK (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND public.has_permission(auth.uid(), 'expenses', 'edit'))
    OR public.has_permission(auth.uid(), 'expenses', 'approve')
  );