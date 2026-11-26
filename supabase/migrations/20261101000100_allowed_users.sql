-- allowed_users: the allow-list that every other table's row-level security checks.
--
-- What it does: creates public.allowed_users, one row per Google account (auth user id)
-- that may use TRI Momentum's data. Every policy on the data tables requires the signed-in
-- user to have a row here, so a stranger who signs in with Google still sees and writes nothing.
--
-- Why a table keyed by user id: the id does not exist until the owner has signed in once, and
-- it should not be committed to a public repo. An id is used rather than an email because an
-- email can change.
--
-- Who can do what: a signed-in user can read only their own row here. Nobody can insert, update
-- or delete from the app, so no one can add themselves. The owner adds their own row by hand in
-- the Supabase SQL editor, which runs as a role that is not restricted by these policies:
--
--     insert into public.allowed_users (user_id, note)
--     values ('<UID copied from Authentication > Users>', 'owner');
--
-- This must be the first migration: the later tables' policies read this table.
--
-- Supabase gives anon and authenticated every privilege on new tables in public by default
-- (including TRUNCATE, which row-level security does not cover). The revoke below removes all
-- of that, then one narrow grant is added back.

begin;

create table public.allowed_users (
  user_id    uuid primary key references auth.users (id),
  note       text,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

revoke all on table public.allowed_users from public, anon, authenticated;
grant select on table public.allowed_users to authenticated;

create policy allowed_users_select_own
  on public.allowed_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;
