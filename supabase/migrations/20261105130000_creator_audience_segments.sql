-- Reusable, private audience filters scoped to the creator's business.
create table if not exists public.creator_audience_segments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_audience_segments_name_length check (char_length(btrim(name)) between 2 and 50),
  constraint creator_audience_segments_filters_object check (jsonb_typeof(filters) = 'object')
);

create unique index if not exists creator_audience_segments_business_name_idx
  on public.creator_audience_segments (business_id, lower(name));
create index if not exists creator_audience_segments_business_idx
  on public.creator_audience_segments (business_id, created_at desc);

alter table public.creator_audience_segments enable row level security;
revoke all on public.creator_audience_segments from anon, authenticated;
grant select, insert, update, delete on public.creator_audience_segments to authenticated;

drop policy if exists creator_audience_segments_owner_select on public.creator_audience_segments;
create policy creator_audience_segments_owner_select on public.creator_audience_segments
  for select to authenticated
  using ((select private.owns_business(business_id)));

drop policy if exists creator_audience_segments_owner_insert on public.creator_audience_segments;
create policy creator_audience_segments_owner_insert on public.creator_audience_segments
  for insert to authenticated
  with check ((select private.owns_business(business_id)) and created_by = (select auth.uid()));

drop policy if exists creator_audience_segments_owner_update on public.creator_audience_segments;
create policy creator_audience_segments_owner_update on public.creator_audience_segments
  for update to authenticated
  using ((select private.owns_business(business_id)))
  with check ((select private.owns_business(business_id)) and created_by = (select auth.uid()));

drop policy if exists creator_audience_segments_owner_delete on public.creator_audience_segments;
create policy creator_audience_segments_owner_delete on public.creator_audience_segments
  for delete to authenticated
  using ((select private.owns_business(business_id)));

comment on table public.creator_audience_segments is
  'Saved creator-defined audience filters. Contains filter rules only, no copied customer personal data.';
