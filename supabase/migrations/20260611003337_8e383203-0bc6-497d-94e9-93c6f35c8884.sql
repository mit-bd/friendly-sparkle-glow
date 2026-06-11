-- Lock down trigger functions (they only run automatically via the DB).
REVOKE EXECUTE ON FUNCTION public.tg_registration_request() FROM PUBLIC, anon, authenticated;

-- Notify owners when a company is suspended.
CREATE OR REPLACE FUNCTION public.tg_company_suspended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    PERFORM public.notify_owners(
      'owner_company_suspended',
      'Company suspended',
      NEW.name || ' has been suspended.'
    );
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.tg_company_suspended() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_company_suspended ON public.companies;
CREATE TRIGGER trg_company_suspended
  AFTER UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_company_suspended();