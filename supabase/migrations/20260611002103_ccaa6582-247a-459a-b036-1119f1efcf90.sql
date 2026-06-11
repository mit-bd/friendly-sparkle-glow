-- ============================================================
-- System Owner Management Module — core schema
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.company_status AS ENUM ('active','suspended','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('free','starter','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registration_status AS ENUM ('pending','approved','rejected','info_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- Owner identity helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner');
$$;

REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Companies registry
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  email text,
  phone text,
  address text,
  status public.company_status NOT NULL DEFAULT 'active',
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  is_primary boolean NOT NULL DEFAULT false,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  suspended_at timestamptz,
  suspended_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages companies" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Profiles: multi-company link + account control fields
-- (added before any policy that references profiles.company_id)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS require_password_change boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE POLICY "Members read own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Seed the primary company from the existing company profile.
INSERT INTO public.companies (name, legal_name, email, phone, address, status, plan, is_primary)
SELECT COALESCE(NULLIF(cp.name,''),'Motion IT BD'), cp.name, cp.email, cp.mobile, cp.address,
       'active', 'enterprise', true
FROM public.company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE is_primary = true)
LIMIT 1;

INSERT INTO public.companies (name, status, plan, is_primary)
SELECT 'Motion IT BD', 'active', 'enterprise', true
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE is_primary = true);

UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies WHERE is_primary = true LIMIT 1)
WHERE company_id IS NULL;

-- Owner cross-platform access (additive — existing policies remain intact)
CREATE POLICY "Owner reads all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owner manages all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owner reads all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owner manages all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owner reads all activity" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));

-- ------------------------------------------------------------
-- Registration requests (public submission, Owner review)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  message text,
  status public.registration_status NOT NULL DEFAULT 'pending',
  info_request_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_requests TO authenticated;
GRANT INSERT ON public.registration_requests TO anon;
GRANT ALL ON public.registration_requests TO service_role;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a registration request" ON public.registration_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Owner reviews registration requests" ON public.registration_requests
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owner updates registration requests" ON public.registration_requests
  FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owner deletes registration requests" ON public.registration_requests
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE TRIGGER trg_registration_requests_updated_at
  BEFORE UPDATE ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Login history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  ip_address text,
  user_agent text,
  event_type text NOT NULL DEFAULT 'login_success',
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users record own login" ON public.login_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own login history" ON public.login_history
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_owner(auth.uid()));

-- ------------------------------------------------------------
-- Security events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  ip_address text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads security events" ON public.security_events
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));

-- ------------------------------------------------------------
-- Notify owners helper + registration trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_owners(_type text, _title text, _body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE in_app boolean;
BEGIN
  SELECT enabled INTO in_app FROM public.notification_settings WHERE channel = 'in_app';
  IF in_app IS DISTINCT FROM true THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT DISTINCT ur.user_id, _type, _title, _body
  FROM public.user_roles ur WHERE ur.role = 'owner';
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_owners(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_owners(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_registration_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_owners(
      'owner_registration_submitted',
      'New registration request',
      NEW.company_name || ' requested access (' || NEW.email || ').'
    );
    INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, entity_label, metadata)
    VALUES (NULL, 'register', 'registration_request', NEW.id, NEW.company_name,
            jsonb_build_object('email', NEW.email, 'contact', NEW.contact_name));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_registration_request_ai
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_registration_request();