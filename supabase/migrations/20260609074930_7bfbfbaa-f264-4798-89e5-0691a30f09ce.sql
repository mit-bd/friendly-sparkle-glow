create table if not exists public.qa_checklist_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  module text not null default 'general',
  area text not null default 'functionality',
  status text not null default 'pending',
  severity text not null default 'medium',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qa_status_chk check (status in ('pending','tested','issue','resolved')),
  constraint qa_severity_chk check (severity in ('low','medium','high','critical')),
  constraint qa_area_chk check (area in ('functionality','data_accuracy','report_accuracy','analytics_accuracy','performance','stability'))
);
grant select, insert, update, delete on public.qa_checklist_items to authenticated;
grant all on public.qa_checklist_items to service_role;
alter table public.qa_checklist_items enable row level security;
create policy "Admins read qa items" on public.qa_checklist_items for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert qa items" on public.qa_checklist_items for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update qa items" on public.qa_checklist_items for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete qa items" on public.qa_checklist_items for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
drop trigger if exists trg_qa_checklist_updated_at on public.qa_checklist_items;
create trigger trg_qa_checklist_updated_at before update on public.qa_checklist_items for each row execute function public.set_updated_at();