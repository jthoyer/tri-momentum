-- races: the race calendar.
--
-- What it does: creates public.races, the Supabase home of the app's `races` array.
-- `id` is a client-generated text id and the primary key is (user_id, id), so inserting the
-- same race twice is ignored. `seq` is assigned by the database and gives the read order.
-- user_id references auth.users with no cascade. `status` is the only constrained text column,
-- because the app already normalises it to 'considering' or 'locked'.
--
-- Who can do what (authenticated only, and only allow-listed users, on their own rows):
-- read, insert and delete. No update: the app edits a race by deleting it and adding it
-- again. anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the three grants
-- are added back.

begin;

create table public.races (
  user_id    uuid        not null default auth.uid() references auth.users (id),
  id         text        not null,
  seq        bigint      generated always as identity,
  created_at timestamptz not null default now(),
  name       text        not null,
  race_date  date        not null,
  url        text        not null default '',
  notes      text        not null default '',
  status     text        not null default 'considering' check (status in ('considering', 'locked')),
  primary key (user_id, id)
);

alter table public.races enable row level security;

revoke all on table public.races from public, anon, authenticated;
-- The identity column's hidden sequence gets the same default grants; take them back too.
revoke all on sequence public.races_seq_seq from public, anon, authenticated;
grant select, insert, delete on table public.races to authenticated;

create policy races_select_own
  on public.races
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy races_insert_own
  on public.races
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy races_delete_own
  on public.races
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
