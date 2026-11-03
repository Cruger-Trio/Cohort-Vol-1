-- Creator-issued, redeemable product access codes.
-- Raw codes are only shown once; only their SHA-256 digests are stored.
create table if not exists public.product_access_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Creator access',
  code_hash text not null unique,
  code_hint text not null,
  max_redemptions integer not null default 1 check (max_redemptions between 1 and 10000),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  access_days integer check (access_days is null or access_days between 1 and 3650),
  expires_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint access_code_label_length check (char_length(label) between 1 and 80),
  constraint access_code_hint_length check (char_length(code_hint) between 4 and 8)
);

create index if not exists product_access_codes_business_created_idx
  on public.product_access_codes (business_id, created_at desc);

alter table public.product_access_codes enable row level security;
revoke all on public.product_access_codes from anon, authenticated;
grant select, insert, update on public.product_access_codes to authenticated;

drop policy if exists product_access_codes_owner_select on public.product_access_codes;
create policy product_access_codes_owner_select on public.product_access_codes
  for select to authenticated
  using (private.owns_business(business_id));

drop policy if exists product_access_codes_owner_insert on public.product_access_codes;
create policy product_access_codes_owner_insert on public.product_access_codes
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.owns_business(business_id)
    and private.owns_product(product_id)
    and exists (select 1 from public.products p where p.id = product_id and p.business_id = product_access_codes.business_id)
  );

drop policy if exists product_access_codes_owner_update on public.product_access_codes;
create policy product_access_codes_owner_update on public.product_access_codes
  for update to authenticated
  using (private.owns_business(business_id))
  with check (
    private.owns_business(business_id)
    and private.owns_product(product_id)
    and exists (select 1 from public.products p where p.id = product_id and p.business_id = product_access_codes.business_id)
  );

-- Creators can revoke or restore a member's access for their own product.
grant update on public.entitlements to authenticated;
drop policy if exists entitlements_creator_update on public.entitlements;
create policy entitlements_creator_update on public.entitlements
  for update to authenticated
  using (private.owns_business(business_id))
  with check (
    private.owns_business(business_id)
    and exists (select 1 from public.products p where p.id = product_id and p.business_id = entitlements.business_id)
  );

create or replace function private.redeem_product_access(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_code public.product_access_codes%rowtype;
  v_product public.products%rowtype;
  v_entitlement public.entitlements%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign in to redeem an access code.' using errcode = '28000';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 12 or char_length(p_code) > 64 then
    raise exception 'That access code is invalid or no longer available.' using errcode = 'P0001';
  end if;

  select * into v_code
    from public.product_access_codes
    where code_hash = encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex')
    for update;
  if not found or v_code.disabled_at is not null
     or (v_code.expires_at is not null and v_code.expires_at <= now())
     or v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'That access code is invalid or no longer available.' using errcode = 'P0001';
  end if;

  select * into v_product from public.products where id = v_code.product_id;
  if not found or v_product.status = 'archived' then
    raise exception 'This creator offer is no longer available.' using errcode = 'P0001';
  end if;

  select * into v_entitlement
    from public.entitlements
    where buyer_id = v_user_id and product_id = v_code.product_id
    order by created_at desc
    limit 1
    for update;

  if found and v_entitlement.status = 'active'
     and (v_entitlement.ends_at is null or v_entitlement.ends_at > now()) then
    return v_product.id;
  end if;

  if found then
    update public.entitlements
      set business_id = v_code.business_id,
          status = 'active', starts_at = now(),
          ends_at = case when v_code.access_days is null then null else now() + make_interval(days => v_code.access_days) end
      where id = v_entitlement.id;
  else
    insert into public.entitlements (buyer_id, business_id, product_id, status, starts_at, ends_at)
      values (v_user_id, v_code.business_id, v_code.product_id, 'active', now(),
        case when v_code.access_days is null then null else now() + make_interval(days => v_code.access_days) end);
  end if;

  update public.product_access_codes
    set redemption_count = redemption_count + 1
    where id = v_code.id;
  return v_product.id;
end;
$function$;

revoke all on function private.redeem_product_access(text) from public, anon;
grant execute on function private.redeem_product_access(text) to authenticated;

create or replace function public.redeem_product_access(p_code text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.redeem_product_access(p_code);
$function$;

revoke all on function public.redeem_product_access(text) from public, anon;
grant execute on function public.redeem_product_access(text) to authenticated;


