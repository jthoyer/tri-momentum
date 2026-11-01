-- plan_sessions: the planned training sessions (the training plan).
--
-- What it does: creates public.plan_sessions, the Supabase home of the app's `plan` array.
-- `id` is a client-generated text id and the primary key is (user_id, id), so inserting the
-- same plan item twice is ignored. `seq` is assigned by the database and gives the read order.
-- Field mapping: date -> plan_date, key -> is_key. user_id references auth.users with no
-- cascade. disc, intensity and phase are not constrained, so out-of-list values round-trip.
--
-- Who can do what (authenticated only, and only allow-listed users, on their own rows):
-- read, insert, delete, and update of seven columns only: disc, title, intensity, duration,
-- is_key, notes, phase. The id, plan_date, user_id and created_at cannot be updated, which
-- enforces in the database the rule that a planned session's date is not editable (to move a
-- session, delete it and add it again). anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the grants are
-- added back. Revoking at table level also removes any column-level grants.

begin;

create table public.plan_sessions (
  user_id    uuid        not null default auth.uid() references auth.users (id),
  id         text        not null,
  seq        bigint      generated always as identity,
  created_at timestamptz not null default now(),
  plan_date  date        not null,
  disc       text        not null default '',
  title      text        not null default '',
  intensity  text        not null default '',
  duration   integer     null,
  is_key     boolean     not null default false,
  notes      text        not null default '',
  phase      text        not null default '',
  primary key (user_id, id)
);

alter table public.plan_sessions enable row level security;

revoke all on table public.plan_sessions from public, anon, authenticated;
-- The identity column's hidden sequence gets the same default grants; take them back too.
revoke all on sequence public.plan_sessions_seq_seq from public, anon, authenticated;
grant select, insert, delete on table public.plan_sessions to authenticated;
grant update (disc, title, intensity, duration, is_key, notes, phase)
  on table public.plan_sessions to authenticated;

create policy plan_sessions_select_own
  on public.plan_sessions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy plan_sessions_insert_own
  on public.plan_sessions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy plan_sessions_update_own
  on public.plan_sessions
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy plan_sessions_delete_own
  on public.plan_sessions
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
