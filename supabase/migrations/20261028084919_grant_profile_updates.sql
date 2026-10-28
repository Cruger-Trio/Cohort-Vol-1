-- The profile owner RLS policy already restricts row updates to auth.uid().
-- This table grant lets authenticated clients reach that policy.
grant update on table public.profiles to authenticated;
