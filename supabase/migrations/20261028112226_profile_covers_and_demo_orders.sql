-- Editable creator profile cover media and safely tagged analytics demo records.
-- Profile covers are public storefront media; uploads remain restricted to each user's folder.
alter table public.profiles
  add column if not exists cover_media_url text,
  add column if not exists cover_media_type text;

alter table public.orders
  add column if not exists is_demo boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-covers', 'profile-covers', true, 20971520,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_covers_owner_all on storage.objects;
create policy profile_covers_owner_all on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
