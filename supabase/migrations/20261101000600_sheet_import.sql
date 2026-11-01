-- sheet_import: the marker that says "this account's Google Sheet history has been imported".
--
-- What it does: creates public.sheet_import, one row per user, written once by the in-app
-- import after all four data kinds have been copied across. Until the row exists the app keeps
-- using its local cache; once it exists, Supabase is the source of truth for that account.
-- `counts` records how many rows of each kind the import wrote. user_id is the primary key, so
-- a second marker for the same user conflicts instead of overwriting. user_id references
-- auth.users with no cascade.
--
-- Who can do what (authenticated only, and only allow-listed users, on their own row):
-- read and insert. No update and no delete from the app: the owner re-opens the import, if
-- ever needed, by deleting the row by hand in the Supabase dashboard. anon and PUBLIC get
-- nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the two grants
-- are added back.

begin;

create table public.sheet_import (
  user_id      uuid        primary key default auth.uid() references auth.users (id),
  completed_at timestamptz not null default now(),
  counts       jsonb       not null
);

alter table public.sheet_import enable row level security;

revoke all on table public.sheet_import from public, anon, authenticated;
grant select, insert on table public.sheet_import to authenticated;

create policy sheet_import_select_own
  on public.sheet_import
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy sheet_import_insert_own
  on public.sheet_import
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
