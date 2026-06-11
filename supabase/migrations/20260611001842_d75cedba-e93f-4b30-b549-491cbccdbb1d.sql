-- System Owner Management: enum extensions (must be its own migration so the
-- new values are committed before they are referenced by functions/policies).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'locked';