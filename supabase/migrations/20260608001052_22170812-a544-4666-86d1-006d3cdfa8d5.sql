
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'accountant', 'viewer');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
CREATE TYPE public.signatory_type AS ENUM ('accountant', 'manager', 'ceo');

-- ========== SHARED: updated_at trigger fn ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  status public.user_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== SECURITY DEFINER HELPERS ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- ========== ROLE PERMISSIONS (permission engine) ==========
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (role, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND CASE _action
        WHEN 'view' THEN rp.can_view
        WHEN 'edit' THEN rp.can_edit
        WHEN 'approve' THEN rp.can_approve
        WHEN 'export' THEN rp.can_export
        ELSE false
      END
  );
$$;

-- ========== COMPANY PROFILE ==========
CREATE TABLE public.company_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  address TEXT,
  mobile TEXT,
  email TEXT,
  website TEXT,
  facebook TEXT,
  whatsapp TEXT,
  trade_license TEXT,
  bin_number TEXT,
  tin_number TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profile TO authenticated;
GRANT ALL ON public.company_profile TO service_role;
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- ========== SIGNATORIES ==========
CREATE TABLE public.signatories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.signatory_type NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  signature_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signatories TO authenticated;
GRANT ALL ON public.signatories TO service_role;
ALTER TABLE public.signatories ENABLE ROW LEVEL SECURITY;

-- ========== NOTIFICATION SETTINGS ==========
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========
-- profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Roles viewable by authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- role_permissions
CREATE POLICY "Permissions viewable by authenticated" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- company_profile
CREATE POLICY "Company viewable by authenticated" ON public.company_profile
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage company" ON public.company_profile
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- signatories
CREATE POLICY "Signatories viewable by authenticated" ON public.signatories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage signatories" ON public.signatories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- notification_settings
CREATE POLICY "Notif settings viewable by authenticated" ON public.notification_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notif settings" ON public.notification_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ========== UPDATED_AT TRIGGERS ==========
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_company_updated BEFORE UPDATE ON public.company_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_signatories_updated BEFORE UPDATE ON public.signatories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_role_perms_updated BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notif_updated BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== NEW USER HANDLER (first user = admin) ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== SEED DEFAULTS ==========
-- Notification channels
INSERT INTO public.notification_settings (channel, enabled) VALUES
  ('in_app', true), ('email', false), ('telegram', false);

-- Company profile (single empty row)
INSERT INTO public.company_profile (name) VALUES ('');

-- Signatories (3 empty rows)
INSERT INTO public.signatories (type, full_name, designation) VALUES
  ('accountant', '', ''), ('manager', '', ''), ('ceo', '', '');

-- Default permissions per role/module
INSERT INTO public.role_permissions (role, module, can_view, can_edit, can_approve, can_export) VALUES
  -- admin: full on every module
  ('admin','dashboard',true,true,true,true),
  ('admin','expenses',true,true,true,true),
  ('admin','marketing',true,true,true,true),
  ('admin','returns',true,true,true,true),
  ('admin','damages',true,true,true,true),
  ('admin','reports',true,true,true,true),
  ('admin','users',true,true,true,true),
  ('admin','settings',true,true,true,true),
  -- manager: view + approve
  ('manager','dashboard',true,false,false,false),
  ('manager','expenses',true,false,true,true),
  ('manager','marketing',true,false,false,false),
  ('manager','returns',true,false,true,false),
  ('manager','damages',true,false,true,false),
  ('manager','reports',true,false,false,true),
  ('manager','users',false,false,false,false),
  ('manager','settings',false,false,false,false),
  -- accountant: create/view
  ('accountant','dashboard',true,false,false,false),
  ('accountant','expenses',true,true,false,true),
  ('accountant','marketing',true,true,false,false),
  ('accountant','returns',true,true,false,false),
  ('accountant','damages',true,true,false,false),
  ('accountant','reports',true,false,false,true),
  ('accountant','users',false,false,false,false),
  ('accountant','settings',false,false,false,false),
  -- viewer: read only
  ('viewer','dashboard',true,false,false,false),
  ('viewer','expenses',true,false,false,false),
  ('viewer','marketing',true,false,false,false),
  ('viewer','returns',true,false,false,false),
  ('viewer','damages',true,false,false,false),
  ('viewer','reports',true,false,false,false),
  ('viewer','users',false,false,false,false),
  ('viewer','settings',false,false,false,false);
