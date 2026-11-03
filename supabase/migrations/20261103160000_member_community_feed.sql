-- Product-scoped private community feed for creator announcements and member replies.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_product_created_idx on public.community_posts (product_id, pinned desc, created_at desc);
create index if not exists community_comments_post_created_idx on public.community_comments (post_id, created_at asc);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
revoke all on public.community_posts, public.community_comments from anon, authenticated;
grant select, insert, update, delete on public.community_posts, public.community_comments to authenticated;

create or replace function private.has_active_product_access(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.product_id = p_product_id
      and e.buyer_id = (select auth.uid())
      and e.status = 'active'
      and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
  );
$$;
revoke all on function private.has_active_product_access(uuid) from public, anon;
grant execute on function private.has_active_product_access(uuid) to authenticated;

drop policy if exists community_posts_read_members_and_owner on public.community_posts;
create policy community_posts_read_members_and_owner on public.community_posts for select to authenticated
using (
  private.has_active_product_access(product_id)
  or exists (select 1 from public.products p where p.id = community_posts.product_id and private.owns_business(p.business_id))
);
drop policy if exists community_posts_create_owner_only on public.community_posts;
create policy community_posts_create_owner_only on public.community_posts for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.products p
    where p.id = community_posts.product_id and p.type in ('Community', 'Membership')
      and private.owns_business(p.business_id)
  )
);
drop policy if exists community_posts_update_owner_only on public.community_posts;
create policy community_posts_update_owner_only on public.community_posts for update to authenticated
using (exists (select 1 from public.products p where p.id = community_posts.product_id and private.owns_business(p.business_id)))
with check (author_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = community_posts.product_id and private.owns_business(p.business_id)));
drop policy if exists community_posts_delete_owner_only on public.community_posts;
create policy community_posts_delete_owner_only on public.community_posts for delete to authenticated
using (exists (select 1 from public.products p where p.id = community_posts.product_id and private.owns_business(p.business_id)));

drop policy if exists community_comments_read_members_and_owner on public.community_comments;
create policy community_comments_read_members_and_owner on public.community_comments for select to authenticated
using (
  exists (select 1 from public.community_posts cp join public.products p on p.id = cp.product_id
    where cp.id = community_comments.post_id and (private.has_active_product_access(p.id) or private.owns_business(p.business_id)))
);
drop policy if exists community_comments_create_members on public.community_comments;
create policy community_comments_create_members on public.community_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.community_posts cp join public.products p on p.id = cp.product_id
    where cp.id = community_comments.post_id and (private.has_active_product_access(p.id) or private.owns_business(p.business_id)))
);
drop policy if exists community_comments_update_author_or_owner on public.community_comments;
create policy community_comments_update_author_or_owner on public.community_comments for update to authenticated
using (
  author_id = (select auth.uid())
  and exists (select 1 from public.community_posts cp join public.products p on p.id = cp.product_id
    where cp.id = community_comments.post_id and (private.has_active_product_access(p.id) or private.owns_business(p.business_id)))
)
with check (author_id = (select auth.uid()));
drop policy if exists community_comments_delete_author_or_owner on public.community_comments;
create policy community_comments_delete_author_or_owner on public.community_comments for delete to authenticated
using (
  author_id = (select auth.uid())
  or exists (select 1 from public.community_posts cp join public.products p on p.id = cp.product_id
    where cp.id = community_comments.post_id and private.owns_business(p.business_id))
);

revoke update on public.community_posts from authenticated;
grant update (body) on public.community_posts to authenticated;
revoke update on public.community_comments from authenticated;
grant update (body) on public.community_comments to authenticated;

comment on table public.community_posts is 'Private creator announcements and posts scoped to a product community.';
comment on table public.community_comments is 'Member replies to private product community posts.';
