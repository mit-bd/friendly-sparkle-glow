-- ============================================================
-- MULTI-TENANT ISOLATION: PART B (RESTRICTIVE company policies)
-- Layered ON TOP of existing role/permission policies.
-- A row is accessible only if it passes the existing rules AND
-- belongs to the caller's company (Owner bypasses to see all).
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'expenses','expense_attachments','expense_comments','expense_events',
    'returns','return_attachments','return_events',
    'damages','damage_attachments','damage_events',
    'receivables','receivable_attachments','receivable_collections','receivable_events',
    'payables','payable_attachments','payable_payments','payable_events',
    'fixed_cost_templates','fixed_cost_payments',
    'budgets','budget_alerts',
    'expense_categories','expense_subcategories','damage_types','return_reasons',
    'marketing_platforms','signatories',
    'report_exports','activity_logs','field_changes','notifications',
    'ai_classification_feedback','qa_checklist_items','company_profile'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.is_owner(auth.uid()) OR company_id = public.current_company_id()) '
      'WITH CHECK (public.is_owner(auth.uid()) OR company_id = public.current_company_id())', t);
  END LOOP;
END $$;

-- Profiles: members/admins limited to their own company; users always see self; Owner sees all
DROP POLICY IF EXISTS profiles_tenant_isolation ON public.profiles;
CREATE POLICY profiles_tenant_isolation ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_owner(auth.uid()) OR id = auth.uid() OR company_id = public.current_company_id())
WITH CHECK (public.is_owner(auth.uid()) OR id = auth.uid() OR company_id = public.current_company_id());

-- User roles: admins limited to their own company's users; users see own; Owner all
DROP POLICY IF EXISTS user_roles_tenant_isolation ON public.user_roles;
CREATE POLICY user_roles_tenant_isolation ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_owner(auth.uid()) OR user_id = auth.uid() OR public.user_company_id(user_id) = public.current_company_id())
WITH CHECK (public.is_owner(auth.uid()) OR public.user_company_id(user_id) = public.current_company_id());

-- Directory function: scope to caller's company (Owner sees all)
CREATE OR REPLACE FUNCTION public.list_directory()
RETURNS TABLE(id uuid, full_name text, email text, avatar_url text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.status::text
  FROM public.profiles p
  WHERE public.is_owner(auth.uid()) OR p.company_id = public.current_company_id();
$$;
