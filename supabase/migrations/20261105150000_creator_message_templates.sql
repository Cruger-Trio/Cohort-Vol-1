create table if not exists public.creator_message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_message_templates_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint creator_message_templates_body_length check (char_length(btrim(body)) between 1 and 2000)
);

create unique index if not exists creator_message_templates_business_name_idx
  on public.creator_message_templates (business_id, lower(name));
create index if not exists creator_message_templates_creator_updated_idx
  on public.creator_message_templates (creator_id, updated_at desc);

alter table public.creator_message_templates enable row level security;
revoke all on public.creator_message_templates from anon, authenticated;
grant select, insert, update, delete on public.creator_message_templates to authenticated;

drop policy if exists creator_message_templates_owner_select on public.creator_message_templates;
create policy creator_message_templates_owner_select on public.creator_message_templates
  for select to authenticated
  using ((select private.owns_business(business_id)) and creator_id = (select auth.uid()));

drop policy if exists creator_message_templates_owner_insert on public.creator_message_templates;
create policy creator_message_templates_owner_insert on public.creator_message_templates
  for insert to authenticated
  with check (
    (select private.owns_business(business_id))
    and creator_id = (select auth.uid())
  );

drop policy if exists creator_message_templates_owner_update on public.creator_message_templates;
create policy creator_message_templates_owner_update on public.creator_message_templates
  for update to authenticated
  using ((select private.owns_business(business_id)) and creator_id = (select auth.uid()))
  with check ((select private.owns_business(business_id)) and creator_id = (select auth.uid()));

drop policy if exists creator_message_templates_owner_delete on public.creator_message_templates;
create policy creator_message_templates_owner_delete on public.creator_message_templates
  for delete to authenticated
  using ((select private.owns_business(business_id)) and creator_id = (select auth.uid()));

comment on table public.creator_message_templates is
  'Private reusable creator inbox message templates scoped to their Cohort business.';
