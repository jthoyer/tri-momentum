-- AC4: an allow-listed user can do every operation in the grant matrix on their own rows;
-- an insert without user_id gets auth.uid(); insert-if-absent leaves the count unchanged.
\ir lib.sql
\ir fixtures.sql
set t.file = '30_owner';

:as_owner;

-- Select: sees their own rows in every table, and only those.
select t.is('owner reads own allowed_users row', (select count(*) from public.allowed_users), 1::bigint);
select t.is('owner reads own session_checkins', (select count(*) from public.session_checkins), 2::bigint);
select t.is('owner reads own races', (select count(*) from public.races), 1::bigint);
select t.is('owner reads own plan_sessions', (select count(*) from public.plan_sessions), 2::bigint);
select t.is('owner reads own phase_blocks', (select count(*) from public.phase_blocks), 2::bigint);
select t.is('owner reads own sheet_import', (select count(*) from public.sheet_import), 1::bigint);

-- Insert with no user_id: the default fills in auth.uid().
select t.is('insert into session_checkins without user_id -> 1 row',
  t.rows($q$insert into public.session_checkins (id, session_date, disc) values ('n-s1','2026-10-05','swim')$q$), 1::bigint);
select t.is('insert into races without user_id -> 1 row',
  t.rows($q$insert into public.races (id, name, race_date) values ('n-r1','New Race','2027-05-01')$q$), 1::bigint);
select t.is('insert into plan_sessions without user_id -> 1 row',
  t.rows($q$insert into public.plan_sessions (id, plan_date, disc) values ('n-p1','2026-11-09','run')$q$), 1::bigint);
select t.is('insert into phase_blocks without user_id -> 1 row',
  t.rows($q$insert into public.phase_blocks (id, from_date, phase) values ('n-ph1','2026-12-01','build1')$q$), 1::bigint);
select t.is('session_checkins.user_id defaulted to the caller',
  (select user_id::text from public.session_checkins where id = 'n-s1'), :'owner_id');
select t.is('races.user_id defaulted to the caller', (select user_id::text from public.races where id = 'n-r1'), :'owner_id');
select t.is('plan_sessions.user_id defaulted to the caller', (select user_id::text from public.plan_sessions where id = 'n-p1'), :'owner_id');
select t.is('phase_blocks.user_id defaulted to the caller', (select user_id::text from public.phase_blocks where id = 'n-ph1'), :'owner_id');
select t.is('column defaults fill in the omitted columns (races.status, session_checkins.note)',
  (select status from public.races where id = 'n-r1') || '/' || (select note from public.session_checkins where id = 'n-s1') || '/',
  'considering//');

-- Insert-if-absent: re-running with the same ids inserts nothing and leaves counts unchanged.
select t.is('re-insert session_checkins on conflict (user_id,id) do nothing -> 0 rows',
  t.rows($q$insert into public.session_checkins (id, session_date, disc) values ('n-s1','2026-10-05','CHANGED') on conflict (user_id, id) do nothing$q$), 0::bigint);
select t.is('re-insert races on conflict do nothing -> 0 rows',
  t.rows($q$insert into public.races (id, name, race_date) values ('n-r1','CHANGED','2027-05-01') on conflict (user_id, id) do nothing$q$), 0::bigint);
select t.is('re-insert plan_sessions on conflict do nothing -> 0 rows',
  t.rows($q$insert into public.plan_sessions (id, plan_date, disc) values ('n-p1','2026-11-09','CHANGED') on conflict (user_id, id) do nothing$q$), 0::bigint);
select t.is('re-insert phase_blocks on conflict do nothing -> 0 rows',
  t.rows($q$insert into public.phase_blocks (id, from_date, phase) values ('n-ph1','2026-12-01','CHANGED') on conflict (user_id, id) do nothing$q$), 0::bigint);
select t.is('row counts after re-run: session_checkins', (select count(*) from public.session_checkins), 3::bigint);
select t.is('row counts after re-run: races', (select count(*) from public.races), 2::bigint);
select t.is('row counts after re-run: plan_sessions', (select count(*) from public.plan_sessions), 3::bigint);
select t.is('row counts after re-run: phase_blocks', (select count(*) from public.phase_blocks), 3::bigint);
select t.is('a re-run did not overwrite the stored row', (select disc from public.session_checkins where id = 'n-s1'), 'swim');
-- The same, but a bulk insert where only some ids are new (a half-finished import being re-run).
select t.is('bulk insert-if-absent with 2 old + 1 new id inserts only the new one',
  t.rows($q$insert into public.races (id, name, race_date) values ('n-r1','x','2027-05-01'),('o-r1','x','2027-05-01'),('n-r2','x','2027-05-01') on conflict (user_id, id) do nothing$q$), 1::bigint);

-- Update (the only updates the matrix grants): plan_sessions' seven columns, phase_blocks' two.
select t.is('owner updates all 7 editable plan_sessions columns -> 1 row',
  t.rows($q$update public.plan_sessions set disc='swim', title='T', intensity='hard', duration=45, is_key=true, notes='N', phase='build1' where id='o-p1'$q$), 1::bigint);
select t.is('plan_sessions update was stored',
  (select disc||'/'||title||'/'||intensity||'/'||duration||'/'||is_key||'/'||notes||'/'||phase from public.plan_sessions where id='o-p1'),
  'swim/T/hard/45/true/N/build1');
select t.is('owner updates phase_blocks.from_date and phase -> 1 row',
  t.rows($q$update public.phase_blocks set from_date='2026-11-15', phase='peak' where id='o-ph1'$q$), 1::bigint);
select t.is('phase_blocks update was stored',
  (select from_date::text||'/'||phase from public.phase_blocks where id='o-ph1'), '2026-11-15/peak');

-- Delete: races, plan_sessions, phase_blocks (by id and by date range, as deleteWeek/deleteRange do).
select t.is('owner deletes a race by id -> 1 row', t.rows($q$delete from public.races where id='n-r2'$q$), 1::bigint);
select t.is('owner deletes a plan_sessions row by id -> 1 row', t.rows($q$delete from public.plan_sessions where id='n-p1'$q$), 1::bigint);
select t.is('owner deletes plan_sessions by date range (deleteWeek) -> 2 rows',
  t.rows($q$delete from public.plan_sessions where plan_date between '2026-11-02' and '2026-11-08'$q$), 2::bigint);
select t.is('owner deletes phase_blocks by date range (deleteRange) -> 1 row',
  t.rows($q$delete from public.phase_blocks where from_date between '2026-11-10' and '2026-11-30'$q$), 1::bigint);
select t.is('owner deletes a phase_blocks row by id -> 1 row', t.rows($q$delete from public.phase_blocks where id='n-ph1'$q$), 1::bigint);

-- sheet_import: insert-if-absent and a conflicting second insert, as a user with no marker yet.
:as_second;
select t.is('allowed user inserts own sheet_import marker without user_id -> 1 row',
  t.rows($q$insert into public.sheet_import (counts) values ('{"sessions":1}')$q$), 1::bigint);
select t.is('sheet_import.user_id defaulted to the caller', (select user_id::text from public.sheet_import), :'second_id');
select t.is('sheet_import re-insert on conflict (user_id) do nothing -> 0 rows',
  t.rows($q$insert into public.sheet_import (counts) values ('{"sessions":99}') on conflict (user_id) do nothing$q$), 0::bigint);
select t.throws('a second sheet_import insert for the same user conflicts',
  $q$insert into public.sheet_import (counts) values ('{"sessions":99}')$q$, '23505', 'duplicate key');
select t.is('sheet_import marker kept its first counts', (select counts->>'sessions' from public.sheet_import), '1');

-- Bulk insert order: does a multi-row insert assign seq in array order? The app relies on
-- "read in seq order" reproducing the order it wrote. The ids are chosen so that id order and
-- array order differ, so a sort by id cannot pass by accident. Checked for both the plain
-- VALUES form and the json_populate_recordset form PostgREST uses.
:as_owner;
insert into public.races (id, name, race_date) values
  ('w-3','bulk','2027-06-01'), ('w-1','bulk','2027-06-01'), ('w-2','bulk','2027-06-01'), ('w-0','bulk','2027-06-01');
select t.is('bulk insert via VALUES: seq follows array order, not id order',
  (select string_agg(id, ',' order by seq) from public.races where id like 'w-%'), 'w-3,w-1,w-2,w-0');
insert into public.races (id, name, race_date)
  select 'v-' || lpad((300 - i)::text, 3, '0'), 'bulk', '2027-06-01' from generate_series(1, 200) i;
select t.is('bulk insert via INSERT..SELECT: seq follows array order (200 rows)',
  (select string_agg(id, ',' order by seq) from public.races where id like 'v-%'),
  (select string_agg('v-' || lpad((300 - i)::text, 3, '0'), ',' order by i) from generate_series(1, 200) i));

with src as (
  select json_agg(json_build_object('id', 'j-' || lpad((300 - i)::text, 3, '0'), 'name', 'bulk', 'race_date', '2027-06-01') order by i) as j
  from generate_series(1, 200) i
)
insert into public.races (id, name, race_date)
  select r.id, r.name, r.race_date from src, json_populate_recordset(null::public.races, src.j) r;
select t.is('bulk insert via json_populate_recordset (PostgREST form): seq follows array order (200 rows)',
  (select string_agg(id, ',' order by seq) from public.races where id like 'j-%'),
  (select string_agg('j-' || lpad((300 - i)::text, 3, '0'), ',' order by i) from generate_series(1, 200) i));
select t.ok('seq is strictly increasing across separate inserts',
  (select bool_and(seq > lag_seq) from (select seq, lag(seq) over (order by created_at, seq) as lag_seq from public.races) s where lag_seq is not null));
select t.throws('the app cannot supply seq itself (GENERATED ALWAYS)',
  $q$insert into public.races (id, name, race_date, seq) values ('s-1','x','2027-01-01', 1)$q$, '428C9', 'non-DEFAULT value');
