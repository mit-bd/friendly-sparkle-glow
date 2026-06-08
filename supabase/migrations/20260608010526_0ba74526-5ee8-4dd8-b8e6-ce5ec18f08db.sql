-- 1. user_roles: stop role enumeration / privilege-escalation reconnaissance.
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;

CREATE POLICY "Users read own roles, admins read all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2. company_profile: hide sensitive tax/license identifiers from non-admins.
DROP POLICY IF EXISTS "Company viewable by authenticated" ON public.company_profile;

CREATE OR REPLACE FUNCTION public.get_company_branding()
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  address text,
  mobile text,
  email text,
  website text,
  facebook text,
  whatsapp text,
  description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, name, logo_url, address, mobile, email, website, facebook, whatsapp, description
  FROM public.company_profile
  ORDER BY created_at ASC
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_company_branding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_branding() TO authenticated;

-- 3. avatars storage: enforce per-user ownership on write/update/delete.
DROP POLICY IF EXISTS "Write avatars" ON storage.objects;
DROP POLICY IF EXISTS "Update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Delete avatars" ON storage.objects;

CREATE POLICY "Write own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. handle_new_user is a SECURITY DEFINER trigger function; revoke direct API execute.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;