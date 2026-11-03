-- Display only the verified author name needed inside each private community.
alter table public.community_posts
  add column if not exists author_name text not null default 'Cohort creator';
alter table public.community_comments
  add column if not exists author_name text not null default 'Cohort member';

create or replace function private.stamp_community_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_id <> (select auth.uid()) then
    raise exception 'Community content must be posted by the signed-in author.' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), ''), 'Cohort member')
    into new.author_name
  from public.profiles p
  where p.id = new.author_id;

  if new.author_name is null then
    new.author_name := 'Cohort member';
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_community_author_name() from public, anon, authenticated;

drop trigger if exists community_posts_stamp_author on public.community_posts;
create trigger community_posts_stamp_author
  before insert on public.community_posts
  for each row execute function private.stamp_community_author_name();
drop trigger if exists community_comments_stamp_author on public.community_comments;
create trigger community_comments_stamp_author
  before insert on public.community_comments
  for each row execute function private.stamp_community_author_name();

revoke all on public.community_posts, public.community_comments from anon, authenticated;
grant select, delete on public.community_posts, public.community_comments to authenticated;
grant insert (product_id, author_id, body) on public.community_posts to authenticated;
grant insert (post_id, author_id, body) on public.community_comments to authenticated;
grant update (body) on public.community_posts, public.community_comments to authenticated;
