-- Reverse the broad grant: signed-in users should only execute the functions the app needs
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- RLS policy helper functions (evaluated as the querying user)
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;

-- RPCs invoked directly from the application
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_report_export(text, text, date, date, jsonb, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_branding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_fixed_costs(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_generate_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_directory() TO authenticated;