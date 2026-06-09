-- ============================================================
-- Phase 15: Budget Management & Expense Control System
-- New management-control layer. Does not modify any existing module.
-- ============================================================

-- ===== Permissions seed (budgets module) =====
insert into public.role_permissions (role, module, can_view, can_edit, can_approve, can_export) values
  ('admin','budgets', true, true, true, true),
  ('manager','budgets', true, true, false, true),
  ('accountant','budgets', true, true, false, true),
  ('viewer','budgets', true, false, false, false)
on conflict (role, module) do nothing;

-- ===== Numbering =====
create table if not exists public.budget_counters (year integer primary key, last_seq integer not null default 0);

create or replace function public.next_budget_number()
returns text language plpgsql security definer set search_path to 'public' as $$
declare y integer := extract(year from now())::integer; seq integer;
begin
  insert into public.budget_counters(year,last_seq) values(y,1)
  on conflict(year) do update set last_seq = public.budget_counters.last_seq + 1
  returning last_seq into seq;
  return 'BUD-'||y::text||'-'||lpad(seq::text,6,'0');
end; $$;

-- ===== Budgets =====
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  budget_number text not null unique default '',
  name text not null,
  budget_type text not null default 'monthly' check (budget_type in ('monthly','quarterly','yearly','custom')),
  period_start date not null,
  period_end date not null,
  target_type text not null default 'category' check (target_type in ('category','subcategory','fixed_cost','marketing','return_loss','damage_loss','finance','custom')),
  category_id uuid references public.expense_categories(id) on delete set null,
  subcategory_id uuid references public.expense_subcategories(id) on delete set null,
  amount numeric not null default 0 check (amount >= 0),
  warning_threshold numeric not null default 80 check (warning_threshold >= 0 and warning_threshold <= 100),
  critical_threshold numeric not null default 100 check (critical_threshold >= 0 and critical_threshold <= 200),
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz,
  restored_by uuid,
  restored_at timestamptz,
  constraint budget_period_chk check (period_end >= period_start)
);
create index if not exists idx_budgets_active on public.budgets (is_active) where deleted_at is null;

-- ===== Budget alerts =====
create table if not exists public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  level text not null check (level in ('warning','near','critical','exceeded')),
  utilization numeric not null default 0,
  used_amount numeric not null default 0,
  period_start date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_alerts_budget on public.budget_alerts (budget_id, period_start, level);

-- ===== GRANTS =====
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.budget_alerts to authenticated;
grant all on public.budgets, public.budget_alerts, public.budget_counters to service_role;

-- ===== RLS =====
alter table public.budgets enable row level security;
alter table public.budget_alerts enable row level security;

create policy "budgets read" on public.budgets for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'budgets','view'));
create policy "budgets insert" on public.budgets for insert to authenticated
  with check ((public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'budgets','edit')) and created_by = auth.uid());
create policy "budgets update" on public.budgets for update to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'budgets','edit'))
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'budgets','edit'));
create policy "budgets delete" on public.budgets for delete to authenticated
  using (public.is_admin(auth.uid()));

create policy "budget_alerts read" on public.budget_alerts for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'budgets','view'));
create policy "budget_alerts insert" on public.budget_alerts for insert to authenticated
  with check (auth.uid() is not null);

-- ===== Numbering + meta trigger =====
create or replace function public.tg_budget_biu()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if new.budget_number is null or new.budget_number = '' then new.budget_number := public.next_budget_number(); end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
  else
    if new.deleted_at is not null and old.deleted_at is null then
      new.deleted_by := auth.uid(); new.restored_at := null; new.restored_by := null;
    elsif new.deleted_at is null and old.deleted_at is not null then
      new.restored_at := now(); new.restored_by := auth.uid(); new.deleted_by := null;
    end if;
    new.updated_at := now();
    if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  end if;
  return new;
end; $$;
create trigger trg_budget_biu before insert or update on public.budgets for each row execute function public.tg_budget_biu();

-- ===== Audit / field-change logging =====
create or replace function public.tg_budget_log()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    values (coalesce(new.created_by,auth.uid()),'create','budget',new.id,new.budget_number||' · '||new.name,
      jsonb_build_object('amount',new.amount,'target_type',new.target_type,'budget_type',new.budget_type));
    return new;
  end if;
  if new.name is distinct from old.name then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('budget',new.id,new.budget_number,'Name',old.name,new.name,auth.uid());
  end if;
  if new.amount is distinct from old.amount then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('budget',new.id,new.budget_number,'Amount',old.amount::text,new.amount::text,auth.uid());
  end if;
  if new.warning_threshold is distinct from old.warning_threshold then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('budget',new.id,new.budget_number,'Warning Threshold',old.warning_threshold::text,new.warning_threshold::text,auth.uid());
  end if;
  if new.critical_threshold is distinct from old.critical_threshold then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('budget',new.id,new.budget_number,'Critical Threshold',old.critical_threshold::text,new.critical_threshold::text,auth.uid());
  end if;
  if (new.period_start is distinct from old.period_start) or (new.period_end is distinct from old.period_end) then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('budget',new.id,new.budget_number,'Period',old.period_start::text||' → '||old.period_end::text,new.period_start::text||' → '||new.period_end::text,auth.uid());
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'delete','budget',new.id,new.budget_number||' · '||new.name,'{}'::jsonb);
  elsif new.deleted_at is null and old.deleted_at is not null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'restore','budget',new.id,new.budget_number||' · '||new.name,'{}'::jsonb);
  elsif (new.name is distinct from old.name or new.amount is distinct from old.amount or new.warning_threshold is distinct from old.warning_threshold or new.critical_threshold is distinct from old.critical_threshold or new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end or new.target_type is distinct from old.target_type or new.is_active is distinct from old.is_active) then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'update','budget',new.id,new.budget_number||' · '||new.name,'{}'::jsonb);
  end if;
  return new;
end; $$;
create trigger trg_budget_log after insert or update on public.budgets for each row execute function public.tg_budget_log();

-- ===== Spend calculation (approved-only) =====
create or replace function public.budget_used_amount(b public.budgets)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
declare v numeric := 0;
begin
  if b.target_type = 'category' then
    select coalesce(sum(amount),0) into v from public.expenses
      where status='approved' and category_id = b.category_id
        and (b.subcategory_id is null or subcategory_id = b.subcategory_id)
        and expense_date between b.period_start and b.period_end;
  elsif b.target_type = 'subcategory' then
    select coalesce(sum(amount),0) into v from public.expenses
      where status='approved' and subcategory_id = b.subcategory_id
        and expense_date between b.period_start and b.period_end;
  elsif b.target_type = 'fixed_cost' then
    select coalesce(sum(amount),0) into v from public.expenses
      where status='approved' and is_fixed_cost = true
        and expense_date between b.period_start and b.period_end;
  elsif b.target_type = 'marketing' then
    select coalesce(sum(amount),0) into v from public.expenses
      where status='approved' and is_marketing = true
        and expense_date between b.period_start and b.period_end;
  elsif b.target_type = 'return_loss' then
    select coalesce(sum(net_loss_amount),0) into v from public.returns
      where status='approved' and return_date between b.period_start and b.period_end;
  elsif b.target_type = 'damage_loss' then
    select coalesce(sum(damage_value),0) into v from public.damages
      where status='approved' and damage_date between b.period_start and b.period_end;
  elsif b.target_type = 'finance' then
    select coalesce(sum(amount),0) into v from public.payables
      where approval_status='approved' and deleted_at is null
        and created_at::date between b.period_start and b.period_end;
  else
    v := 0;
  end if;
  return v;
end; $$;

-- ===== Alert engine =====
create or replace function public.budget_generate_alerts()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  b public.budgets;
  v_used numeric;
  v_util numeric;
  v_level text;
  v_existing integer;
  in_app boolean;
  n integer := 0;
begin
  select enabled into in_app from public.notification_settings where channel='in_app';
  for b in select * from public.budgets where is_active = true and deleted_at is null loop
    v_used := public.budget_used_amount(b);
    if b.amount <= 0 then continue; end if;
    v_util := (v_used / b.amount) * 100;

    if v_util > 100 then v_level := 'exceeded';
    elsif v_util >= b.critical_threshold then v_level := 'critical';
    elsif v_util >= 90 then v_level := 'near';
    elsif v_util >= b.warning_threshold then v_level := 'warning';
    else v_level := null;
    end if;

    if v_level is null then continue; end if;

    select count(*) into v_existing from public.budget_alerts
      where budget_id = b.id and level = v_level and period_start = b.period_start;
    if v_existing > 0 then continue; end if;

    insert into public.budget_alerts(budget_id,level,utilization,used_amount,period_start)
      values (b.id, v_level, round(v_util,2), v_used, b.period_start);

    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
      values (null,'generate','budget',b.id, b.budget_number||' · '||b.name,
        jsonb_build_object('level',v_level,'utilization',round(v_util,2),'used',v_used));

    if in_app is true then
      insert into public.notifications(user_id,type,title,body)
      select distinct ur.user_id,
        'budget_'||v_level,
        case v_level
          when 'exceeded' then 'Budget exceeded'
          when 'critical' then 'Budget critical'
          when 'near' then 'Budget at 90%'
          else 'Budget warning' end,
        b.name||' is at '||round(v_util,0)::text||'% of budget.'
      from public.user_roles ur
      where ur.role in ('admin','manager') or public.has_permission(ur.user_id,'budgets','view');
    end if;

    n := n + 1;
  end loop;
  return n;
end; $$;

revoke all on function public.budget_generate_alerts() from public, anon;