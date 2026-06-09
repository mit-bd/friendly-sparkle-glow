
-- ===== Counters & numbering =====
create table if not exists public.receivable_counters (year integer primary key, last_seq integer not null default 0);
create table if not exists public.payable_counters (year integer primary key, last_seq integer not null default 0);

create or replace function public.next_receivable_number()
returns text language plpgsql security definer set search_path to 'public' as $$
declare y integer := extract(year from now())::integer; seq integer;
begin
  insert into public.receivable_counters(year,last_seq) values(y,1)
  on conflict(year) do update set last_seq = public.receivable_counters.last_seq + 1
  returning last_seq into seq;
  return 'RCV-'||y::text||'-'||lpad(seq::text,6,'0');
end; $$;

create or replace function public.next_payable_number()
returns text language plpgsql security definer set search_path to 'public' as $$
declare y integer := extract(year from now())::integer; seq integer;
begin
  insert into public.payable_counters(year,last_seq) values(y,1)
  on conflict(year) do update set last_seq = public.payable_counters.last_seq + 1
  returning last_seq into seq;
  return 'PAY-'||y::text||'-'||lpad(seq::text,6,'0');
end; $$;

-- ===== Receivables =====
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  receivable_number text not null unique default '',
  party_name text not null,
  party_type text not null default 'customer',
  contact_person text,
  mobile text,
  email text,
  reference_number text,
  amount numeric not null default 0 check (amount >= 0),
  collected_amount numeric not null default 0 check (collected_amount >= 0),
  due_amount numeric generated always as (amount - collected_amount) stored,
  due_date date,
  notes text,
  status text not null default 'pending' check (status in ('pending','partially_received','received','overdue','cancelled')),
  approval_status text not null default 'pending_approval' check (approval_status in ('pending_approval','approved','rejected','revision_requested')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  rejected_by uuid, rejected_at timestamptz,
  deleted_by uuid, deleted_at timestamptz,
  restored_by uuid, restored_at timestamptz,
  constraint receivable_party_type_chk check (party_type in ('customer','courier','dealer','reseller','distributor','employee','vendor_refund','other'))
);

-- ===== Payables =====
create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  payable_number text not null unique default '',
  party_name text not null,
  party_type text not null default 'supplier',
  contact_person text,
  mobile text,
  email text,
  reference_number text,
  amount numeric not null default 0 check (amount >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  due_amount numeric generated always as (amount - paid_amount) stored,
  due_date date,
  notes text,
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','overdue','cancelled')),
  approval_status text not null default 'pending_approval' check (approval_status in ('pending_approval','approved','rejected','revision_requested')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  rejected_by uuid, rejected_at timestamptz,
  deleted_by uuid, deleted_at timestamptz,
  restored_by uuid, restored_at timestamptz,
  constraint payable_party_type_chk check (party_type in ('supplier','service_provider','landlord','marketing_agency','freelancer','contractor','employee_reimbursement','other'))
);

-- ===== Collections / Payments =====
create table if not exists public.receivable_collections (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  amount numeric not null check (amount > 0),
  collection_date date not null default current_date,
  notes text,
  file_path text, file_name text, mime_type text, size_bytes integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.payable_payments (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.payables(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_date date not null default current_date,
  notes text,
  file_path text, file_name text, mime_type text, size_bytes integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===== Attachments =====
create table if not exists public.receivable_attachments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  file_path text not null, file_name text, mime_type text, size_bytes integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.payable_attachments (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.payables(id) on delete cascade,
  file_path text not null, file_name text, mime_type text, size_bytes integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===== Events (timeline) =====
create table if not exists public.receivable_events (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  actor_id uuid, action text not null, from_status text, to_status text, notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.payable_events (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.payables(id) on delete cascade,
  actor_id uuid, action text not null, from_status text, to_status text, notes text,
  created_at timestamptz not null default now()
);

-- ===== Notifications link columns =====
alter table public.notifications add column if not exists receivable_id uuid references public.receivables(id) on delete cascade;
alter table public.notifications add column if not exists payable_id uuid references public.payables(id) on delete cascade;

-- ===== GRANTS =====
grant select, insert, update, delete on public.receivables to authenticated;
grant select, insert, update, delete on public.payables to authenticated;
grant select, insert, update, delete on public.receivable_collections to authenticated;
grant select, insert, update, delete on public.payable_payments to authenticated;
grant select, insert, update, delete on public.receivable_attachments to authenticated;
grant select, insert, update, delete on public.payable_attachments to authenticated;
grant select, insert, update, delete on public.receivable_events to authenticated;
grant select, insert, update, delete on public.payable_events to authenticated;
grant all on public.receivables, public.payables, public.receivable_collections, public.payable_payments, public.receivable_attachments, public.payable_attachments, public.receivable_events, public.payable_events to service_role;

-- ===== RLS =====
alter table public.receivables enable row level security;
alter table public.payables enable row level security;
alter table public.receivable_collections enable row level security;
alter table public.payable_payments enable row level security;
alter table public.receivable_attachments enable row level security;
alter table public.payable_attachments enable row level security;
alter table public.receivable_events enable row level security;
alter table public.payable_events enable row level security;

-- receivables policies
create policy "finance read receivables" on public.receivables for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or created_by = auth.uid());
create policy "finance insert receivables" on public.receivables for insert to authenticated
  with check ((public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit')) and created_by = auth.uid());
create policy "finance update receivables" on public.receivables for update to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve') or (created_by = auth.uid() and public.has_permission(auth.uid(),'finance','edit')))
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve') or (created_by = auth.uid() and public.has_permission(auth.uid(),'finance','edit')));
create policy "finance delete receivables" on public.receivables for delete to authenticated
  using (public.is_admin(auth.uid()));

-- payables policies
create policy "finance read payables" on public.payables for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or created_by = auth.uid());
create policy "finance insert payables" on public.payables for insert to authenticated
  with check ((public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit')) and created_by = auth.uid());
create policy "finance update payables" on public.payables for update to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve') or (created_by = auth.uid() and public.has_permission(auth.uid(),'finance','edit')))
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve') or (created_by = auth.uid() and public.has_permission(auth.uid(),'finance','edit')));
create policy "finance delete payables" on public.payables for delete to authenticated
  using (public.is_admin(auth.uid()));

-- child table policies (receivables)
create policy "finance read rcol" on public.receivable_collections for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.receivables r where r.id = receivable_id and r.created_by = auth.uid()));
create policy "finance write rcol" on public.receivable_collections for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance del rcol" on public.receivable_collections for delete to authenticated
  using (public.is_admin(auth.uid()));
create policy "finance read ratt" on public.receivable_attachments for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.receivables r where r.id = receivable_id and r.created_by = auth.uid()));
create policy "finance write ratt" on public.receivable_attachments for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance del ratt" on public.receivable_attachments for delete to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance read revt" on public.receivable_events for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.receivables r where r.id = receivable_id and r.created_by = auth.uid()));
create policy "finance write revt" on public.receivable_events for insert to authenticated
  with check (auth.uid() is not null);

-- child table policies (payables)
create policy "finance read ppay" on public.payable_payments for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.payables p where p.id = payable_id and p.created_by = auth.uid()));
create policy "finance write ppay" on public.payable_payments for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance del ppay" on public.payable_payments for delete to authenticated
  using (public.is_admin(auth.uid()));
create policy "finance read patt" on public.payable_attachments for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.payables p where p.id = payable_id and p.created_by = auth.uid()));
create policy "finance write patt" on public.payable_attachments for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance del patt" on public.payable_attachments for delete to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','edit') or public.has_permission(auth.uid(),'finance','approve'));
create policy "finance read pevt" on public.payable_events for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','view') or exists (select 1 from public.payables p where p.id = payable_id and p.created_by = auth.uid()));
create policy "finance write pevt" on public.payable_events for insert to authenticated
  with check (auth.uid() is not null);

-- ===== Settlement compute + meta triggers =====
create or replace function public.tg_receivable_biu()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if new.receivable_number is null or new.receivable_number = '' then new.receivable_number := public.next_receivable_number(); end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.submitted_at is null and new.approval_status = 'pending_approval' then
      new.submitted_at := now(); new.submitted_by := coalesce(new.created_by, auth.uid());
    end if;
  else
    if new.approval_status is distinct from old.approval_status then
      if new.approval_status = 'approved' then new.approved_at := now(); new.approved_by := auth.uid();
      elsif new.approval_status = 'rejected' then new.rejected_at := now(); new.rejected_by := auth.uid();
      end if;
    end if;
    if new.deleted_at is not null and old.deleted_at is null then new.deleted_by := auth.uid(); new.restored_at := null; new.restored_by := null;
    elsif new.deleted_at is null and old.deleted_at is not null then new.restored_at := now(); new.restored_by := auth.uid(); new.deleted_by := null;
    end if;
    new.updated_at := now();
    if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  end if;
  if new.status <> 'cancelled' then
    if (new.amount - new.collected_amount) <= 0 and new.amount > 0 then new.status := 'received';
    elsif new.due_date is not null and new.due_date < current_date and (new.amount - new.collected_amount) > 0 then new.status := 'overdue';
    elsif new.collected_amount > 0 then new.status := 'partially_received';
    else new.status := 'pending';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.tg_payable_biu()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if new.payable_number is null or new.payable_number = '' then new.payable_number := public.next_payable_number(); end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.submitted_at is null and new.approval_status = 'pending_approval' then
      new.submitted_at := now(); new.submitted_by := coalesce(new.created_by, auth.uid());
    end if;
  else
    if new.approval_status is distinct from old.approval_status then
      if new.approval_status = 'approved' then new.approved_at := now(); new.approved_by := auth.uid();
      elsif new.approval_status = 'rejected' then new.rejected_at := now(); new.rejected_by := auth.uid();
      end if;
    end if;
    if new.deleted_at is not null and old.deleted_at is null then new.deleted_by := auth.uid(); new.restored_at := null; new.restored_by := null;
    elsif new.deleted_at is null and old.deleted_at is not null then new.restored_at := now(); new.restored_by := auth.uid(); new.deleted_by := null;
    end if;
    new.updated_at := now();
    if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  end if;
  if new.status <> 'cancelled' then
    if (new.amount - new.paid_amount) <= 0 and new.amount > 0 then new.status := 'paid';
    elsif new.due_date is not null and new.due_date < current_date and (new.amount - new.paid_amount) > 0 then new.status := 'overdue';
    elsif new.paid_amount > 0 then new.status := 'partially_paid';
    else new.status := 'pending';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_receivable_biu before insert or update on public.receivables for each row execute function public.tg_receivable_biu();
create trigger trg_payable_biu before insert or update on public.payables for each row execute function public.tg_payable_biu();

-- ===== Approval permission enforcement =====
create or replace function public.tg_receivable_enforce()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.approval_status in ('approved','rejected','revision_requested') and new.approval_status is distinct from old.approval_status then
    if not (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve')) then
      raise exception 'Not authorized to approve, reject, or request revision on finance records';
    end if;
  end if;
  if old.approval_status = 'approved' and (new.amount is distinct from old.amount or new.party_name is distinct from old.party_name or new.party_type is distinct from old.party_type or new.due_date is distinct from old.due_date) then
    if not (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve')) then
      raise exception 'Approved finance records are locked and can only be modified by an admin or approver';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.tg_payable_enforce()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.approval_status in ('approved','rejected','revision_requested') and new.approval_status is distinct from old.approval_status then
    if not (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve')) then
      raise exception 'Not authorized to approve, reject, or request revision on finance records';
    end if;
  end if;
  if old.approval_status = 'approved' and (new.amount is distinct from old.amount or new.party_name is distinct from old.party_name or new.party_type is distinct from old.party_type or new.due_date is distinct from old.due_date) then
    if not (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'finance','approve')) then
      raise exception 'Approved finance records are locked and can only be modified by an admin or approver';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_receivable_enforce before update on public.receivables for each row execute function public.tg_receivable_enforce();
create trigger trg_payable_enforce before update on public.payables for each row execute function public.tg_payable_enforce();

-- ===== Activity / field-change / notification logging =====
create or replace function public.tg_receivable_log()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare in_app boolean; act text;
begin
  select enabled into in_app from public.notification_settings where channel='in_app';
  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    values (coalesce(new.created_by,auth.uid()),'create','receivable',new.id,new.receivable_number,jsonb_build_object('amount',new.amount,'approval_status',new.approval_status));
    if in_app is true and new.approval_status='pending_approval' then
      insert into public.notifications(user_id,type,title,body,receivable_id)
      select distinct ur.user_id,'finance_receivable_submitted','New receivable for approval',new.receivable_number||' needs approval.',new.id
      from public.user_roles ur
      where (ur.role='admin' or public.has_permission(ur.user_id,'finance','approve')) and ur.user_id <> coalesce(new.created_by,auth.uid());
    end if;
    return new;
  end if;
  if new.amount is distinct from old.amount then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('receivable',new.id,new.receivable_number,'Amount',old.amount::text,new.amount::text,auth.uid());
  end if;
  if new.collected_amount is distinct from old.collected_amount then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('receivable',new.id,new.receivable_number,'Collected Amount',old.collected_amount::text,new.collected_amount::text,auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('receivable',new.id,new.receivable_number,'Settlement Status',old.status,new.status,auth.uid());
  end if;
  if new.approval_status is distinct from old.approval_status then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('receivable',new.id,new.receivable_number,'Approval Status',old.approval_status,new.approval_status,auth.uid());
    act := case new.approval_status when 'approved' then 'approve' when 'rejected' then 'reject' when 'revision_requested' then 'revision_request' else 'update' end;
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),act,'receivable',new.id,new.receivable_number,jsonb_build_object('from',old.approval_status,'to',new.approval_status));
    if in_app is true then
      insert into public.notifications(user_id,type,title,body,receivable_id)
      select distinct uid,'finance_receivable_'||new.approval_status,'Receivable '||replace(new.approval_status,'_',' '),new.receivable_number||' is now '||replace(new.approval_status,'_',' ')||'.',new.id
      from (select unnest(array[new.created_by,new.submitted_by]) uid) s where uid is not null and uid <> auth.uid();
    end if;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'delete','receivable',new.id,new.receivable_number,'{}'::jsonb);
  elsif new.deleted_at is null and old.deleted_at is not null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'restore','receivable',new.id,new.receivable_number,'{}'::jsonb);
  end if;
  return new;
end; $$;

create or replace function public.tg_payable_log()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare in_app boolean; act text;
begin
  select enabled into in_app from public.notification_settings where channel='in_app';
  if tg_op = 'INSERT' then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    values (coalesce(new.created_by,auth.uid()),'create','payable',new.id,new.payable_number,jsonb_build_object('amount',new.amount,'approval_status',new.approval_status));
    if in_app is true and new.approval_status='pending_approval' then
      insert into public.notifications(user_id,type,title,body,payable_id)
      select distinct ur.user_id,'finance_payable_submitted','New payable for approval',new.payable_number||' needs approval.',new.id
      from public.user_roles ur
      where (ur.role='admin' or public.has_permission(ur.user_id,'finance','approve')) and ur.user_id <> coalesce(new.created_by,auth.uid());
    end if;
    return new;
  end if;
  if new.amount is distinct from old.amount then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('payable',new.id,new.payable_number,'Amount',old.amount::text,new.amount::text,auth.uid());
  end if;
  if new.paid_amount is distinct from old.paid_amount then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('payable',new.id,new.payable_number,'Paid Amount',old.paid_amount::text,new.paid_amount::text,auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('payable',new.id,new.payable_number,'Settlement Status',old.status,new.status,auth.uid());
  end if;
  if new.approval_status is distinct from old.approval_status then
    insert into public.field_changes(entity_type,entity_id,entity_label,field,old_value,new_value,changed_by) values('payable',new.id,new.payable_number,'Approval Status',old.approval_status,new.approval_status,auth.uid());
    act := case new.approval_status when 'approved' then 'approve' when 'rejected' then 'reject' when 'revision_requested' then 'revision_request' else 'update' end;
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),act,'payable',new.id,new.payable_number,jsonb_build_object('from',old.approval_status,'to',new.approval_status));
    if in_app is true then
      insert into public.notifications(user_id,type,title,body,payable_id)
      select distinct uid,'finance_payable_'||new.approval_status,'Payable '||replace(new.approval_status,'_',' '),new.payable_number||' is now '||replace(new.approval_status,'_',' ')||'.',new.id
      from (select unnest(array[new.created_by,new.submitted_by]) uid) s where uid is not null and uid <> auth.uid();
    end if;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'delete','payable',new.id,new.payable_number,'{}'::jsonb);
  elsif new.deleted_at is null and old.deleted_at is not null then
    insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata) values(auth.uid(),'restore','payable',new.id,new.payable_number,'{}'::jsonb);
  end if;
  return new;
end; $$;

create trigger trg_receivable_log after insert or update on public.receivables for each row execute function public.tg_receivable_log();
create trigger trg_payable_log after insert or update on public.payables for each row execute function public.tg_payable_log();

-- ===== Collection / payment application =====
create or replace function public.tg_receivable_collection()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare rec public.receivables; in_app boolean; delta numeric;
begin
  if tg_op='INSERT' then delta := new.amount; else delta := -old.amount; end if;
  update public.receivables set collected_amount = greatest(0, collected_amount + delta)
    where id = coalesce(new.receivable_id, old.receivable_id) returning * into rec;
  insert into public.receivable_events(receivable_id,actor_id,action,notes)
    values(coalesce(new.receivable_id,old.receivable_id),auth.uid(), case when tg_op='INSERT' then 'collection_added' else 'collection_removed' end, coalesce(new.notes,old.notes));
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    values(auth.uid(), case when tg_op='INSERT' then 'collection_added' else 'collection_removed' end,'receivable',rec.id,rec.receivable_number,jsonb_build_object('amount',coalesce(new.amount,old.amount)));
  if tg_op='INSERT' then
    select enabled into in_app from public.notification_settings where channel='in_app';
    if in_app is true then
      insert into public.notifications(user_id,type,title,body,receivable_id)
      select distinct uid,'finance_collection_added','Collection recorded',rec.receivable_number||' collected '||new.amount::text||'.',rec.id
      from (select unnest(array[rec.created_by,rec.approved_by]) uid) s where uid is not null and uid <> auth.uid();
    end if;
    return new;
  end if;
  return old;
end; $$;

create or replace function public.tg_payable_payment()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare rec public.payables; in_app boolean; delta numeric;
begin
  if tg_op='INSERT' then delta := new.amount; else delta := -old.amount; end if;
  update public.payables set paid_amount = greatest(0, paid_amount + delta)
    where id = coalesce(new.payable_id, old.payable_id) returning * into rec;
  insert into public.payable_events(payable_id,actor_id,action,notes)
    values(coalesce(new.payable_id,old.payable_id),auth.uid(), case when tg_op='INSERT' then 'payment_added' else 'payment_removed' end, coalesce(new.notes,old.notes));
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,entity_label,metadata)
    values(auth.uid(), case when tg_op='INSERT' then 'payment_added' else 'payment_removed' end,'payable',rec.id,rec.payable_number,jsonb_build_object('amount',coalesce(new.amount,old.amount)));
  if tg_op='INSERT' then
    select enabled into in_app from public.notification_settings where channel='in_app';
    if in_app is true then
      insert into public.notifications(user_id,type,title,body,payable_id)
      select distinct uid,'finance_payment_added','Payment recorded',rec.payable_number||' paid '||new.amount::text||'.',rec.id
      from (select unnest(array[rec.created_by,rec.approved_by]) uid) s where uid is not null and uid <> auth.uid();
    end if;
    return new;
  end if;
  return old;
end; $$;

create trigger trg_receivable_collection after insert or delete on public.receivable_collections for each row execute function public.tg_receivable_collection();
create trigger trg_payable_payment after insert or delete on public.payable_payments for each row execute function public.tg_payable_payment();

-- ===== Daily overdue automation + due reminders =====
create or replace function public.finance_mark_overdue()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer := 0; r record; in_app boolean;
begin
  select enabled into in_app from public.notification_settings where channel='in_app';
  for r in select * from public.receivables where approval_status='approved' and deleted_at is null and status in ('pending','partially_received') and due_date is not null and due_date < current_date and (amount-collected_amount) > 0 loop
    update public.receivables set status='overdue' where id=r.id; n := n+1;
    if in_app is true and r.created_by is not null then
      insert into public.notifications(user_id,type,title,body,receivable_id) values(r.created_by,'finance_receivable_overdue','Receivable overdue',r.receivable_number||' is overdue.',r.id);
    end if;
  end loop;
  for r in select * from public.payables where approval_status='approved' and deleted_at is null and status in ('pending','partially_paid') and due_date is not null and due_date < current_date and (amount-paid_amount) > 0 loop
    update public.payables set status='overdue' where id=r.id; n := n+1;
    if in_app is true and r.created_by is not null then
      insert into public.notifications(user_id,type,title,body,payable_id) values(r.created_by,'finance_payable_overdue','Payable overdue',r.payable_number||' is overdue.',r.id);
    end if;
  end loop;
  if in_app is true then
    for r in select * from public.receivables where approval_status='approved' and deleted_at is null and status in ('pending','partially_received') and due_date = current_date + 1 and (amount-collected_amount) > 0 loop
      if r.created_by is not null then
        insert into public.notifications(user_id,type,title,body,receivable_id) values(r.created_by,'finance_receivable_due','Receivable due tomorrow',r.receivable_number||' is due tomorrow.',r.id);
      end if;
    end loop;
    for r in select * from public.payables where approval_status='approved' and deleted_at is null and status in ('pending','partially_paid') and due_date = current_date + 1 and (amount-paid_amount) > 0 loop
      if r.created_by is not null then
        insert into public.notifications(user_id,type,title,body,payable_id) values(r.created_by,'finance_payable_due','Payable due tomorrow',r.payable_number||' is due tomorrow.',r.id);
      end if;
    end loop;
  end if;
  return n;
end; $$;
