-- 1) Restrict base profiles table: full rows (incl. phone/email) only to owner or admin
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Profiles viewable by owner or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Safe staff directory (no phone) for pickers/search, available to all signed-in users
CREATE OR REPLACE FUNCTION public.list_directory()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.status::text
  FROM public.profiles p
$$;

-- 2) field_changes: managers must also have audit view permission
DROP POLICY IF EXISTS "field changes read" ON public.field_changes;

CREATE POLICY "field changes read"
ON public.field_changes
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'manager'::app_role) OR changed_by = auth.uid())
    AND public.has_permission(auth.uid(), 'audit'::text, 'view'::text)
  )
);

-- 3) Storage: tighten expense-attachments read policy to match table access
DROP POLICY IF EXISTS "Read expense attachments" ON storage.objects;

CREATE POLICY "Read expense attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-attachments'
  AND (
    public.is_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.expense_attachments ea
      JOIN public.expenses e ON e.id = ea.expense_id
      WHERE ea.file_path = storage.objects.name
        AND (
          public.has_permission(auth.uid(), 'expenses'::text, 'view'::text)
          OR e.created_by = auth.uid()
        )
    )
  )
);

-- 4) Remove anonymous/public EXECUTE on all SECURITY DEFINER (and other) functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_directory() TO authenticated;