-- AI-Assisted Expense Classification: enhancement only, additive schema.

-- 1) Flag auto-created subcategories so admins can identify AI-generated ones.
ALTER TABLE public.expense_subcategories
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false;

-- 2) Lightweight learning table: stores user corrections to AI suggestions.
CREATE TABLE IF NOT EXISTS public.ai_classification_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description_text text NOT NULL,
  normalized_text text NOT NULL,
  suggested_category_id uuid,
  suggested_subcategory_id uuid,
  chosen_category_id uuid,
  chosen_subcategory_id uuid,
  was_override boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_normalized
  ON public.ai_classification_feedback (normalized_text);

GRANT SELECT, INSERT ON public.ai_classification_feedback TO authenticated;
GRANT ALL ON public.ai_classification_feedback TO service_role;

ALTER TABLE public.ai_classification_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read all feedback (drives shared learning suggestions).
CREATE POLICY "Authenticated can read classification feedback"
  ON public.ai_classification_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users may record their own corrections.
CREATE POLICY "Authenticated can insert classification feedback"
  ON public.ai_classification_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
