-- Yearly counter for unique report numbers (RPT-YYYY-000001)
CREATE TABLE public.report_counters (
  year integer PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.report_counters TO authenticated;
GRANT ALL ON public.report_counters TO service_role;
ALTER TABLE public.report_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER functions below touch this table.

CREATE OR REPLACE FUNCTION public.next_report_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  y integer := EXTRACT(YEAR FROM now())::integer;
  seq integer;
BEGIN
  INSERT INTO public.report_counters (year, last_seq)
  VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = public.report_counters.last_seq + 1
  RETURNING last_seq INTO seq;
  RETURN 'RPT-' || y::text || '-' || lpad(seq::text, 6, '0');
END;
$$;

-- Export history / archive of generated reports
CREATE TABLE public.report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text NOT NULL UNIQUE,
  report_type text NOT NULL,
  title text NOT NULL,
  range_from date,
  range_to date,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  expense_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.report_exports TO authenticated;
GRANT ALL ON public.report_exports TO service_role;

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can read export history"
ON public.report_exports
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'reports', 'view')
  OR public.has_permission(auth.uid(), 'reports', 'export')
  OR generated_by = auth.uid()
);

CREATE POLICY "Users can log their own report exports"
ON public.report_exports
FOR INSERT
TO authenticated
WITH CHECK (generated_by = auth.uid());

-- Atomic, authorized creation of a report number + history entry.
CREATE OR REPLACE FUNCTION public.log_report_export(
  _report_type text,
  _title text,
  _range_from date,
  _range_to date,
  _filters jsonb,
  _expense_count integer,
  _total_amount numeric
)
RETURNS public.report_exports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rn text;
  rec public.report_exports;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'reports', 'view')
    OR public.has_permission(auth.uid(), 'reports', 'export')
  ) THEN
    RAISE EXCEPTION 'Not authorized to generate reports';
  END IF;

  rn := public.next_report_number();

  INSERT INTO public.report_exports (
    report_number, report_type, title, range_from, range_to,
    filters, expense_count, total_amount, generated_by
  )
  VALUES (
    rn, _report_type, _title, _range_from, _range_to,
    COALESCE(_filters, '{}'::jsonb), COALESCE(_expense_count, 0),
    COALESCE(_total_amount, 0), auth.uid()
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_report_export(text, text, date, date, jsonb, integer, numeric) TO authenticated;
