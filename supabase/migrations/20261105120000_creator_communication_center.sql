-- Private one-to-one conversations between a creator and an existing customer.
create table if not exists public.creator_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint creator_conversations_distinct_participants check (creator_id <> customer_id),
  constraint creator_conversations_one_per_customer unique (business_id, customer_id)
);

create index if not exists creator_conversations_creator_recent_idx
  on public.creator_conversations (creator_id, last_message_at desc);
create index if not exists creator_conversations_customer_recent_idx
  on public.creator_conversations (customer_id, last_message_at desc);

create table if not exists public.creator_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.creator_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint creator_messages_body_length check (char_length(body) between 1 and 4000),
  constraint creator_messages_body_not_blank check (length(btrim(body)) > 0)
);

create index if not exists creator_messages_conversation_recent_idx
  on public.creator_messages (conversation_id, created_at desc);

alter table public.creator_conversations enable row level security;
alter table public.creator_messages enable row level security;
revoke all on public.creator_conversations, public.creator_messages from anon, authenticated;
grant select, insert on public.creator_conversations to authenticated;
grant select, insert, update on public.creator_messages to authenticated;

drop policy if exists creator_conversations_participant_read on public.creator_conversations;
create policy creator_conversations_participant_read on public.creator_conversations
  for select to authenticated
  using (creator_id = (select auth.uid()) or customer_id = (select auth.uid()));

drop policy if exists creator_conversations_creator_start on public.creator_conversations;
create policy creator_conversations_creator_start on public.creator_conversations
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and private.owns_business(business_id)
    and (
      exists (select 1 from public.orders o
        where o.business_id = creator_conversations.business_id
          and o.buyer_id = creator_conversations.customer_id
          and o.status = 'paid')
      or exists (select 1 from public.entitlements e
        where e.business_id = creator_conversations.business_id
          and e.buyer_id = creator_conversations.customer_id
          and e.status = 'active')
    )
  );

drop policy if exists creator_messages_participant_read on public.creator_messages;
create policy creator_messages_participant_read on public.creator_messages
  for select to authenticated
  using (exists (
    select 1 from public.creator_conversations c
    where c.id = creator_messages.conversation_id
      and ((select auth.uid()) = c.creator_id or (select auth.uid()) = c.customer_id)
  ));

drop policy if exists creator_messages_participant_send on public.creator_messages;
create policy creator_messages_participant_send on public.creator_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and read_at is null
    and exists (
      select 1 from public.creator_conversations c
      where c.id = creator_messages.conversation_id
        and ((select auth.uid()) = c.creator_id or (select auth.uid()) = c.customer_id)
    )
  );

drop policy if exists creator_messages_recipient_mark_read on public.creator_messages;
create policy creator_messages_recipient_mark_read on public.creator_messages
  for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.creator_conversations c
      where c.id = creator_messages.conversation_id
        and ((select auth.uid()) = c.creator_id or (select auth.uid()) = c.customer_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and read_at is not null
    and exists (
      select 1 from public.creator_conversations c
      where c.id = creator_messages.conversation_id
        and ((select auth.uid()) = c.creator_id or (select auth.uid()) = c.customer_id)
    )
  );

create or replace function private.guard_creator_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Messages cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists creator_messages_immutable_content on public.creator_messages;
create trigger creator_messages_immutable_content
  before update on public.creator_messages
  for each row execute function private.guard_creator_message_update();

create or replace function private.touch_creator_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.creator_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id
      and (creator_id = (select auth.uid()) or customer_id = (select auth.uid()));
  return new;
end;
$$;

revoke all on function private.touch_creator_conversation() from public, anon, authenticated;
drop trigger if exists creator_messages_touch_conversation on public.creator_messages;
create trigger creator_messages_touch_conversation
  after insert on public.creator_messages
  for each row execute function private.touch_creator_conversation();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'creator_messages') then
    alter publication supabase_realtime add table public.creator_messages;
  end if;
end;
$$;

comment on table public.creator_conversations is
  'Private one-to-one threads between a Cohort creator and an existing customer.';
comment on table public.creator_messages is
  'Immutable private direct messages. Only the recipient may set read_at.';
