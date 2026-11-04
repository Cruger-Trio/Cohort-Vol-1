-- Private creator CRM notes and tags for customers already associated with a business.
create table if not exists public.customer_relationships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  tags text[] not null default '{}',
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (business_id, customer_id),
  constraint customer_relationships_note_length check (char_length(note) <= 2000),
  constraint customer_relationships_tag_count check (cardinality(tags) <= 8),
  constraint customer_relationships_tag_length check (
    array_position(tags, null) is null
    and array_to_string(tags, E'\n') !~ '(^|\n)\s*(\n|$)'
    and array_to_string(tags, E'\n') !~ '(^|\n).{25,}(\n|$)'
  )
);

create index if not exists customer_relationships_customer_idx
  on public.customer_relationships (customer_id);

alter table public.customer_relationships enable row level security;
revoke all on public.customer_relationships from anon, authenticated;
grant select, insert, update, delete on public.customer_relationships to authenticated;

drop policy if exists customer_relationships_owner_read on public.customer_relationships;
create policy customer_relationships_owner_read on public.customer_relationships
  for select to authenticated
  using (private.owns_business(business_id));

drop policy if exists customer_relationships_owner_insert on public.customer_relationships;
create policy customer_relationships_owner_insert on public.customer_relationships
  for insert to authenticated
  with check (
    private.owns_business(business_id)
    and (
      exists (select 1 from public.orders o where o.business_id = customer_relationships.business_id and o.buyer_id = customer_relationships.customer_id)
      or exists (select 1 from public.entitlements e where e.business_id = customer_relationships.business_id and e.buyer_id = customer_relationships.customer_id)
    )
  );

drop policy if exists customer_relationships_owner_update on public.customer_relationships;
create policy customer_relationships_owner_update on public.customer_relationships
  for update to authenticated
  using (private.owns_business(business_id))
  with check (
    private.owns_business(business_id)
    and (
      exists (select 1 from public.orders o where o.business_id = customer_relationships.business_id and o.buyer_id = customer_relationships.customer_id)
      or exists (select 1 from public.entitlements e where e.business_id = customer_relationships.business_id and e.buyer_id = customer_relationships.customer_id)
    )
  );

drop policy if exists customer_relationships_owner_delete on public.customer_relationships;
create policy customer_relationships_owner_delete on public.customer_relationships
  for delete to authenticated
  using (private.owns_business(business_id));

comment on table public.customer_relationships is
  'Private business-owner CRM notes and tags for buyers or members; never exposed in the public catalog.';
