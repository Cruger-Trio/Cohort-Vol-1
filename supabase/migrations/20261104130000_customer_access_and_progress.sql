-- Creator-managed access overrides, member blocks and truthful resource progress.
create table if not exists public.business_customer_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

create table if not exists public.customer_product_access (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  resource_id uuid references public.product_deliverables(id) on delete cascade,
  effect text not null check (effect in ('grant', 'revoke')),
  reason text not null default '' check (char_length(reason) <= 500),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_product_access_scope_check check (resource_id is null or effect in ('grant','revoke'))
);
create unique index if not exists customer_product_access_product_unique
  on public.customer_product_access (business_id, customer_id, product_id) where resource_id is null;
create unique index if not exists customer_product_access_resource_unique
  on public.customer_product_access (business_id, customer_id, product_id, resource_id) where resource_id is not null;
create index if not exists customer_product_access_customer_idx on public.customer_product_access (business_id, customer_id, product_id);

create table if not exists public.member_resource_progress (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  resource_id uuid not null references public.product_deliverables(id) on delete cascade,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (customer_id, resource_id)
);
create index if not exists member_resource_progress_customer_idx on public.member_resource_progress (business_id, customer_id, updated_at desc);

alter table public.business_customer_blocks enable row level security;
alter table public.customer_product_access enable row level security;
alter table public.member_resource_progress enable row level security;
revoke all on public.business_customer_blocks, public.customer_product_access, public.member_resource_progress from anon, authenticated;
grant select, insert, update, delete on public.business_customer_blocks, public.customer_product_access to authenticated;
grant select, insert, update on public.member_resource_progress to authenticated;

drop policy if exists business_customer_blocks_owner_all on public.business_customer_blocks;
create policy business_customer_blocks_owner_all on public.business_customer_blocks for all to authenticated
  using (private.owns_business(business_id)) with check (private.owns_business(business_id));
drop policy if exists customer_product_access_owner_all on public.customer_product_access;
create policy customer_product_access_owner_all on public.customer_product_access for all to authenticated
  using (private.owns_business(customer_product_access.business_id) and exists (select 1 from public.products p where p.id = customer_product_access.product_id and p.business_id = customer_product_access.business_id))
  with check (private.owns_business(customer_product_access.business_id) and exists (select 1 from public.products p where p.id = customer_product_access.product_id and p.business_id = customer_product_access.business_id));
drop policy if exists customer_product_access_member_read on public.customer_product_access;
create policy customer_product_access_member_read on public.customer_product_access for select to authenticated using (customer_id = (select auth.uid()));

create or replace function private.is_business_customer_blocked(p_business_id uuid, p_customer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_customer_blocks b where b.business_id=p_business_id and b.customer_id=p_customer_id)
$$;
revoke all on function private.is_business_customer_blocked(uuid,uuid) from public, anon;
grant execute on function private.is_business_customer_blocked(uuid,uuid) to authenticated;

create or replace function private.has_active_product_access(p_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not private.is_business_customer_blocked(p.business_id, (select auth.uid())) and (
    coalesce((select a.effect='grant' from public.customer_product_access a
      where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id is null limit 1), false)
    or (not exists (select 1 from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id is null and a.effect='revoke')
      and exists (select 1 from public.entitlements e where e.product_id=p_product_id and e.buyer_id=(select auth.uid()) and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())))
  ) from public.products p where p.id=p_product_id
$$;
revoke all on function private.has_active_product_access(uuid) from public, anon;
grant execute on function private.has_active_product_access(uuid) to authenticated;

create or replace function private.can_access_product_resource(p_product_id uuid, p_resource_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.is_business_customer_blocked(p.business_id,(select auth.uid())) then false
    when exists (select 1 from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id=p_resource_id) then
      (select a.effect='grant' from public.customer_product_access a where a.product_id=p_product_id and a.customer_id=(select auth.uid()) and a.resource_id=p_resource_id limit 1)
    else private.has_active_product_access(p_product_id)
  end
  from public.products p where p.id=p_product_id
$$;
revoke all on function private.can_access_product_resource(uuid,uuid) from public, anon;
grant execute on function private.can_access_product_resource(uuid,uuid) to authenticated;

drop policy if exists deliverables_select on public.product_deliverables;
create policy deliverables_select on public.product_deliverables for select to authenticated
  using (private.owns_product(product_id) or private.can_access_product_resource(product_id,id));

drop policy if exists member_resource_progress_owner_read on public.member_resource_progress;
create policy member_resource_progress_owner_read on public.member_resource_progress for select to authenticated
  using (private.owns_business(business_id));
drop policy if exists member_resource_progress_member_read on public.member_resource_progress;
create policy member_resource_progress_member_read on public.member_resource_progress for select to authenticated
  using (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id));
drop policy if exists member_resource_progress_member_insert on public.member_resource_progress;
create policy member_resource_progress_member_insert on public.member_resource_progress for insert to authenticated
  with check (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id));
drop policy if exists member_resource_progress_member_update on public.member_resource_progress;
create policy member_resource_progress_member_update on public.member_resource_progress for update to authenticated
  using (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id))
  with check (customer_id=(select auth.uid()) and private.can_access_product_resource(product_id,resource_id));

comment on table public.business_customer_blocks is 'Creator business-specific member bans; blocks override all product and resource access.';
comment on table public.customer_product_access is 'Creator-granted or revoked access, separate from orders and revenue.';
comment on table public.member_resource_progress is 'Member-reported completion timestamps for product resources; not a proxy for lesson engagement.';
