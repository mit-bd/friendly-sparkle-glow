-- 1. field_changes: strict audit-permission gate (no role shortcut)
DROP POLICY IF EXISTS "field changes read" ON public.field_changes;
CREATE POLICY "field changes read" ON public.field_changes
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR has_permission(auth.uid(), 'audit', 'view')
);

-- 2. Storage: cover return/damage attachment reads via their tables
DROP POLICY IF EXISTS "Read expense attachments" ON storage.objects;
CREATE POLICY "Read expense attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-attachments'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.expense_attachments ea
      JOIN public.expenses e ON e.id = ea.expense_id
      WHERE ea.file_path = objects.name
        AND (has_permission(auth.uid(), 'expenses', 'view') OR e.created_by = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.return_attachments ra
      JOIN public.returns r ON r.id = ra.return_id
      WHERE ra.file_path = objects.name
        AND (has_permission(auth.uid(), 'returns', 'view') OR r.created_by = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.damage_attachments da
      JOIN public.damages d ON d.id = da.damage_id
      WHERE da.file_path = objects.name
        AND (has_permission(auth.uid(), 'damages', 'view') OR d.created_by = auth.uid())
    )
  )
);