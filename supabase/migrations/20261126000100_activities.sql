-- activities: recorded workouts, for TM-014's scheduled analysis.
--
-- What it does: creates public.activities, one row per recorded activity (Garmin, Strava, ...).
-- The rows are written by a scheduled Claude run that uses the owner's Supabase management
-- access (which is not restricted by row-level security), NOT by the app and NOT with the
-- app's key. The app only reads them, after sign-in.
--
-- Because the writer is not an app user, user_id has NO default (no auth.uid()): the writer
-- must say whose row it is. user_id references auth.users with no cascade. `id` is a text id
-- chosen by the writer; (user_id, id) is the primary key. (user_id, source, source_id) is
-- unique so the same activity from the same source cannot be stored twice. `seq` is assigned
-- by the database and gives the read order.
--
-- Who can do what: authenticated, only allow-listed users, only their own rows, SELECT only.
-- No insert, update, delete or truncate from the app. anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the one grant
-- is added back. The identity column's hidden sequence gets the same defaults; they are
-- revoked too, and nothing is granted back (the app never inserts).

begin;

create table public.activities (
  user_id        uuid        not null references auth.users (id),
  id             text        not null,
  source         text        not null,
  source_id      text        not null,
  activity_date  date        not null,
  start_time     timestamptz null,
  sport          text        not null default '',
  name           text        not null default '',
  moving_minutes numeric     null,
  distance_km    numeric     null,
  avg_hr         integer     null,
  avg_power      integer     null,
  avg_pace       text        null,
  elevation_m    numeric     null,
  load           numeric     null,
  check_status   text        null,
  created_at     timestamptz not null default now(),
  seq            bigint      generated always as identity,
  primary key (user_id, id),
  unique (user_id, source, source_id)
);

alter table public.activities enable row level security;

revoke all on table public.activities from public, anon, authenticated;
revoke all on sequence public.activities_seq_seq from public, anon, authenticated;
grant select on table public.activities to authenticated;

create policy activities_select_own
  on public.activities
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
