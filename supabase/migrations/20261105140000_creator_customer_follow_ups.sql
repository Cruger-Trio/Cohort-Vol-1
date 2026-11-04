-- Private reminders for a creator's individual customer follow-up workflow.
create table if not exists public.customer_follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  notes text not null default '',
  due_at timestamptz not null,
  status text not null default 'open',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_follow_ups_title_length check (char_length(btrim(title)) between 3 and 100),
  constraint customer_follow_ups_notes_length check (char_length(notes) <= 1000),
  constraint customer_follow_ups_status check (status in ('open', 'done', 'cancelled')),
  constraint customer_follow_ups_completion check ((status = 'done') = (completed_at is not null))
);

create index if not exists customer_follow_ups_business_queue_idx
  on public.customer_follow_ups (business_id, status, due_at);
create index if not exists customer_follow_ups_customer_idx
  on public.customer_follow_ups (business_id, customer_id, due_at desc);

alter table public.customer_follow_ups enable row level security;
revoke all on public.customer_follow_ups from anon, authenticated;
grant select, insert, update, delete on public.customer_follow_ups to authenticated;

drop policy if exists customer_follow_ups_owner_select on public.customer_follow_ups;
create policy customer_follow_ups_owner_select on public.customer_follow_ups
  for select to authenticated
  using ((select private.owns_business(business_id)));

drop policy if exists customer_follow_ups_owner_insert on public.customer_follow_ups;
create policy customer_follow_ups_owner_insert on public.customer_follow_ups
  for insert to authenticated
  with check (
    (select private.owns_business(business_id))
    and created_by = (select auth.uid())
    and (
      exists (select 1 from public.orders o where o.business_id = customer_follow_ups.business_id and o.buyer_id = customer_follow_ups.customer_id)
      or exists (select 1 from public.entitlements e where e.business_id = customer_follow_ups.business_id and e.buyer_id = customer_follow_ups.customer_id)
    )
  );

drop policy if exists customer_follow_ups_owner_update on public.customer_follow_ups;
create policy customer_follow_ups_owner_update on public.customer_follow_ups
  for update to authenticated
  using ((select private.owns_business(business_id)))
  with check ((select private.owns_business(business_id)) and created_by = (select auth.uid()));

drop policy if exists customer_follow_ups_owner_delete on public.customer_follow_ups;
create policy customer_follow_ups_owner_delete on public.customer_follow_ups
  for delete to authenticated
  using ((select private.owns_business(business_id)));

comment on table public.customer_follow_ups is
  'Private creator reminders for customer follow-up; never sends a message automatically.';
