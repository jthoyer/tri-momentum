-- phase_blocks: the dated training-phase plan.
--
-- What it does: creates public.phase_blocks, the Supabase home of the app's `phasePlan`
-- array: one row per block, saying which training phase starts on which date. `id` is a
-- client-generated text id (including the per-user id 'legacy') and the primary key is
-- (user_id, id), so two users can never collide and inserting the same block twice is
-- ignored. `seq` gives the read order. Field mapping: from -> from_date. user_id references
-- auth.users with no cascade. `phase` is not constrained, so new phase names round-trip.
--
-- Who can do what (authenticated only, and only allow-listed users, on their own rows):
-- read, insert, delete, and update of two columns only: from_date and phase. The id, user_id
-- and created_at cannot be updated. anon and PUBLIC get nothing.
--
-- Supabase's default grants (ALL, including TRUNCATE) are revoked first, then the grants are
-- added back. Revoking at table level also removes any column-level grants.

begin;

create table public.phase_blocks (
  user_id    uuid        not null default auth.uid() references auth.users (id),
  id         text        not null,
  seq        bigint      generated always as identity,
  created_at timestamptz not null default now(),
  from_date  date        not null,
  phase      text        not null,
  primary key (user_id, id)
);

alter table public.phase_blocks enable row level security;

revoke all on table public.phase_blocks from public, anon, authenticated;
-- The identity column's hidden sequence gets the same default grants; take them back too.
revoke all on sequence public.phase_blocks_seq_seq from public, anon, authenticated;
grant select, insert, delete on table public.phase_blocks to authenticated;
grant update (from_date, phase) on table public.phase_blocks to authenticated;

create policy phase_blocks_select_own
  on public.phase_blocks
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy phase_blocks_insert_own
  on public.phase_blocks
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

create policy phase_blocks_update_own
  on public.phase_blocks
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

create policy phase_blocks_delete_own
  on public.phase_blocks
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.allowed_users a where a.user_id = (select auth.uid()))
  );

commit;
