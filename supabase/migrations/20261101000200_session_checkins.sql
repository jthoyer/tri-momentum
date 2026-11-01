-- session_checkins: one row per logged training session (the check-in log).
--
-- What it does: creates public.session_checkins, the Supabase home of the app's `log` array.
-- Columns mirror the existing client fields (date -> session_date, loggedAt in ms ->
-- logged_at). `id` is a client-generated text id, and the primary key is (user_id, id), so
-- the app can insert the same session twice (a retry, or a re-run of the import) and the
-- second insert is ignored. `seq` is assigned by the database and gives the read order, which
-- reproduces the Sheet's append order. user_id references auth.users with no cascade, so
-- deleting or recreating the auth user can never silently delete training history.
--
-- disc, intensity and phase have no allowed-value check on purpose: the Sheet is hand-editable
-- and out-of-list values must round-trip.
--
-- Who can do what (authenticated only, and only allow-listed users, on their own rows):
-- read and insert. No update and no delete: a check-in is a record, and the app has no way to
-- edit or remove one. anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the two grants
-- are added back.

begin;

create table public.session_checkins (
  user_id      uuid        not null default auth.uid() references auth.users (id),
  id           text        not null,
  seq          bigint      generated always as identity,
  created_at   timestamptz not null default now(),
  session_date date        not null,
  disc         text        not null default '',
  duration     integer     null,
  intensity    text        not null default '',
  rpe          integer     null,
  a1           text        null,
  a2           text        null,
  a3           text        null,
  b2           text        null,
  b3           text        null,
  note         text        not null default '',
  phase        text        null,
  logged_at    timestamptz null,
  primary key (user_id, id)
);

alter table public.session_checkins enable row level security;

revoke all on table public.session_checkins from public, anon, authenticated;
-- The identity column's hidden sequence gets the same default grants; take them back too.
revoke all on sequence public.session_checkins_seq_seq from public, anon, authenticated;
grant select, insert on table public.session_checkins to authenticated;

create policy session_checkins_select_own
  on public.session_checkins
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy session_checkins_insert_own
  on public.session_checkins
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
