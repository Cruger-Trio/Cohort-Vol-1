-- Link a manually sent reply to a reminder and record its outcome atomically.
alter table public.customer_follow_ups drop constraint customer_follow_ups_status;
alter table public.customer_follow_ups add constraint customer_follow_ups_status
  check (status in ('open', 'waiting', 'done', 'cancelled'));

create table public.customer_follow_up_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.customer_follow_ups(id) on delete cascade,
  message_id uuid not null unique references public.creator_messages(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  outcome text not null check (outcome in ('awaiting_reply','resolved','needs_follow_up')),
  created_at timestamptz not null default now()
);
create index customer_follow_up_events_timeline_idx
  on public.customer_follow_up_events(follow_up_id, created_at desc);
create index customer_follow_up_events_created_by_idx
  on public.customer_follow_up_events(created_by);
alter table public.customer_follow_up_events enable row level security;
revoke all on public.customer_follow_up_events from anon, authenticated;
grant select, insert on public.customer_follow_up_events to authenticated;

create policy follow_up_events_owner_read on public.customer_follow_up_events
  for select to authenticated using (
    exists (select 1 from public.customer_follow_ups f
      where f.id = follow_up_id and private.owns_business(f.business_id))
  );
create policy follow_up_events_owner_record on public.customer_follow_up_events
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.customer_follow_ups f
      join public.creator_conversations c on c.business_id = f.business_id and c.customer_id = f.customer_id
      join public.creator_messages m on m.conversation_id = c.id
      where f.id = follow_up_id and m.id = message_id
        and m.sender_id = (select auth.uid()) and c.creator_id = (select auth.uid())
        and private.owns_business(f.business_id)
    )
  );

create function public.send_creator_follow_up_reply(
  p_conversation_id uuid, p_follow_up_id uuid, p_body text,
  p_outcome text, p_message_id uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  task public.customer_follow_ups%rowtype;
  previous public.customer_follow_up_events%rowtype;
  stamp timestamptz := now();
begin
  if auth.uid() is null or p_message_id is null then
    raise exception 'Sign in to send this follow-up.';
  end if;
  if p_outcome is null or p_outcome not in ('awaiting_reply','resolved','needs_follow_up') then
    raise exception 'Choose a follow-up outcome.';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Write a message between 1 and 4,000 characters.';
  end if;
  select f.* into task from public.customer_follow_ups f
    join public.creator_conversations c on c.business_id = f.business_id and c.customer_id = f.customer_id
    where f.id = p_follow_up_id and c.id = p_conversation_id and c.creator_id = auth.uid()
    for update of f;
  if not found then raise exception 'This reminder does not belong to this conversation.'; end if;

  -- The client retains this message ID after an uncertain network response.
  select * into previous from public.customer_follow_up_events where message_id = p_message_id;
  if found then
    if previous.follow_up_id <> p_follow_up_id or previous.created_by <> auth.uid()
      or previous.outcome <> p_outcome or not exists (
        select 1 from public.creator_messages where id = p_message_id
          and conversation_id = p_conversation_id and sender_id = auth.uid() and body = btrim(p_body)
      ) then raise exception 'This send attempt was already used with different content.'; end if;
    return p_message_id;
  end if;
  if task.status not in ('open','waiting') then
    raise exception 'This reminder is already closed. Reopen it before sending a linked reply.';
  end if;
  insert into public.creator_messages(id,conversation_id,sender_id,body)
    values(p_message_id,p_conversation_id,auth.uid(),btrim(p_body));
  insert into public.customer_follow_up_events(follow_up_id,message_id,created_by,outcome)
    values(p_follow_up_id,p_message_id,auth.uid(),p_outcome);
  update public.customer_follow_ups set
    status = case p_outcome when 'resolved' then 'done' when 'awaiting_reply' then 'waiting' else 'open' end,
    completed_at = case when p_outcome = 'resolved' then stamp else null end,
    updated_at = stamp
    where id = p_follow_up_id;
  if not found then raise exception 'Could not update this reminder.'; end if;
  return p_message_id;
end;
$$;
revoke all on function public.send_creator_follow_up_reply(uuid,uuid,text,text,uuid) from public, anon;
grant execute on function public.send_creator_follow_up_reply(uuid,uuid,text,text,uuid) to authenticated;
comment on table public.customer_follow_up_events is 'Private creator follow-up outcomes linked to manually sent messages.';
