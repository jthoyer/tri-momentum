-- analysis: the weekly written analysis, for TM-014.
--
-- What it does: creates public.analysis, one row per user per training week. `week_start` is
-- the Monday of the week (a check constraint refuses any other day). `findings` is free-form
-- JSON written by the scheduled Claude run. Like public.activities, it is written with the
-- owner's Supabase management access, NOT by the app and NOT with the app's key; the app only
-- reads it, after sign-in.
--
-- user_id has NO default (no auth.uid()): the writer is not an app user and must say whose
-- row it is. user_id references auth.users with no cascade. The primary key is
-- (user_id, week_start), so a second row for the same week conflicts instead of duplicating.
--
-- Who can do what: authenticated, only allow-listed users, only their own rows, SELECT only.
-- No insert, update, delete or truncate from the app. anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the one grant
-- is added back. There is no identity column, so there is no sequence to revoke.

begin;

create table public.analysis (
  user_id      uuid        not null references auth.users (id),
  week_start   date        not null constraint analysis_week_start_monday check (extract(isodow from week_start) = 1),
  headline     text        not null default '',
  findings     jsonb       not null default '[]',
  sources      text        null,
  generated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.analysis enable row level security;

revoke all on table public.analysis from public, anon, authenticated;
grant select on table public.analysis to authenticated;

create policy analysis_select_own
  on public.analysis
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
