
-- READ: any authenticated user can read these buckets (enables signed URLs)
CREATE POLICY "Read logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logos');
CREATE POLICY "Read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Read signatures" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures');

-- LOGOS: admins manage
CREATE POLICY "Admins write logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.is_admin(auth.uid()));

-- SIGNATURES: admins manage
CREATE POLICY "Admins write signatures" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update signatures" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete signatures" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND public.is_admin(auth.uid()));

-- AVATARS: any authenticated user can upload/manage
CREATE POLICY "Write avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Update avatars" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Delete avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
