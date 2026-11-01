-- AC5: users cannot touch each other's rows, cannot write a row under someone else's user_id,
-- and anon is stopped by privilege (permission denied), not just by an empty result.
\ir lib.sql
\ir fixtures.sql
set t.file = '40_isolation';

-- A second ALLOW-LISTED user: the allow-list is not what stops them, only the user_id test.
:as_second;
select t.is('second sees 0 of the owner''s session_checkins', (select count(*) from public.session_checkins where user_id = :'owner_id'), 0::bigint);
select t.is('second sees 0 of the owner''s races', (select count(*) from public.races where user_id = :'owner_id'), 0::bigint);
select t.is('second sees 0 of the owner''s plan_sessions', (select count(*) from public.plan_sessions where user_id = :'owner_id'), 0::bigint);
select t.is('second sees 0 of the owner''s phase_blocks', (select count(*) from public.phase_blocks where user_id = :'owner_id'), 0::bigint);
select t.is('second sees 0 of the owner''s sheet_import', (select count(*) from public.sheet_import where user_id = :'owner_id'), 0::bigint);
select t.is('second sees only own rows in session_checkins', (select count(*) from public.session_checkins), 1::bigint);
select t.is('second sees only own rows in phase_blocks (same id "legacy" as the owner, separate rows)', (select count(*) from public.phase_blocks), 1::bigint);
select t.is('second reading by the owner''s exact id still gets nothing', (select count(*) from public.races where id = 'o-r1'), 0::bigint);

select t.is('second updates the owner''s plan_sessions row -> 0 rows affected',
  t.rows($q$update public.plan_sessions set title = 'HACKED' where id = 'o-p1'$q$), 0::bigint);
select t.is('second updates every plan_sessions row it can -> only its own 1',
  t.rows($q$update public.plan_sessions set title = 'mine'$q$), 1::bigint);
select t.is('second updates the owner''s phase_blocks row -> 0 rows affected',
  t.rows($q$update public.phase_blocks set phase = 'HACKED' where id = 'o-ph1'$q$), 0::bigint);
select t.is('second''s unfiltered update of phase_blocks changes only their own 1 row (UPDATE policy alone, no WHERE)',
  t.rows($q$update public.phase_blocks set phase = 'x'$q$), 1::bigint);
select t.is('second deletes the owner''s race -> 0 rows affected', t.rows($q$delete from public.races where id = 'o-r1'$q$), 0::bigint);
select t.is('second deletes the owner''s plan_sessions rows -> 0 rows affected', t.rows($q$delete from public.plan_sessions where user_id = '00000000-0000-4000-8000-000000000001'$q$), 0::bigint);
select t.is('second deletes the owner''s phase_blocks rows -> 0 rows affected', t.rows($q$delete from public.phase_blocks where id = 'legacy' and user_id = '00000000-0000-4000-8000-000000000001'$q$), 0::bigint);
select t.is('an unfiltered delete by second removes only second''s own phase row',
  t.rows($q$delete from public.phase_blocks$q$), 1::bigint);
select t.is('an unfiltered delete by second removes only second''s own plan_sessions row (DELETE policy alone, no WHERE)',
  t.rows($q$delete from public.plan_sessions$q$), 1::bigint);
select t.is('an unfiltered delete by second removes only second''s own race',
  t.rows($q$delete from public.races$q$), 1::bigint);

select t.rls_rejected('second cannot insert a session_checkins row carrying the owner''s user_id',
  $q$insert into public.session_checkins (user_id, id, session_date) values ('00000000-0000-4000-8000-000000000001','evil-1','2026-10-09')$q$);
select t.rls_rejected('second cannot insert a races row carrying the owner''s user_id',
  $q$insert into public.races (user_id, id, name, race_date) values ('00000000-0000-4000-8000-000000000001','evil-1','x','2027-01-01')$q$);
select t.rls_rejected('second cannot insert a plan_sessions row carrying the owner''s user_id',
  $q$insert into public.plan_sessions (user_id, id, plan_date) values ('00000000-0000-4000-8000-000000000001','evil-1','2026-10-09')$q$);
select t.rls_rejected('second cannot insert a phase_blocks row carrying the owner''s user_id',
  $q$insert into public.phase_blocks (user_id, id, from_date, phase) values ('00000000-0000-4000-8000-000000000001','evil-1','2026-10-09','base')$q$);
select t.rls_rejected('second cannot insert a sheet_import row carrying the owner''s user_id',
  $q$insert into public.sheet_import (user_id, counts) values ('00000000-0000-4000-8000-000000000001','{}')$q$);
select t.rls_rejected('one foreign row in a bulk insert rejects the whole statement',
  $q$insert into public.races (user_id, id, name, race_date) values
     ('00000000-0000-4000-8000-000000000002','bulk-ok','x','2027-01-01'),
     ('00000000-0000-4000-8000-000000000001','bulk-evil','x','2027-01-01')$q$);
select t.is('...and the good row in that bulk insert was not stored either',
  (select count(*) from public.races where id = 'bulk-ok'), 0::bigint);
select t.rls_rejected('insert-if-absent cannot be used to plant a row under the owner''s id',
  $q$insert into public.races (user_id, id, name, race_date) values ('00000000-0000-4000-8000-000000000001','o-r1','x','2027-01-01') on conflict (user_id, id) do nothing$q$);

-- Same text id in two accounts is fine (composite key) and does not disturb the owner.
select t.is('second inserts own row reusing the owner''s id "o-r1" -> 1 row',
  t.rows($q$insert into public.races (id, name, race_date) values ('o-r1','mine','2027-01-01')$q$), 1::bigint);

:as_super;
select t.is('owner''s rows survived second''s attempts: session_checkins', (select count(*) from public.session_checkins where user_id = :'owner_id'), 2::bigint);
select t.is('owner''s rows survived: races (and name unchanged)', (select name from public.races where user_id = :'owner_id' and id = 'o-r1'), 'Owner Olympic');
select t.is('owner''s rows survived: plan_sessions title unchanged', (select title from public.plan_sessions where id = 'o-p1'), 'Easy run');
select t.is('owner''s rows survived: phase_blocks', (select count(*) from public.phase_blocks where user_id = :'owner_id'), 2::bigint);
select t.is('owner''s phase_blocks phase unchanged', (select phase from public.phase_blocks where id = 'o-ph1'), 'base');
select t.is('nothing was stored under evil ids', (select count(*) from public.races where id like 'evil-%' or id like 'bulk-%'), 0::bigint);

-- The reverse direction too: the owner cannot see or alter second's rows.
:as_owner;
select t.is('owner sees 0 of second''s races', (select count(*) from public.races where user_id = :'second_id'), 0::bigint);
select t.is('owner updates second''s plan_sessions row -> 0 rows', t.rows($q$update public.plan_sessions set title='x' where id = 'x-p1'$q$), 0::bigint);
select t.is('owner deletes second''s race -> 0 rows', t.rows($q$delete from public.races where id = 'x-r1'$q$), 0::bigint);

-- anon: stopped by privilege on every table and every operation, with or without claims.
:as_anon;
select t.denied('anon cannot select from ' || tbl, 'select * from public.' || tbl)
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
select t.denied('anon cannot insert into ' || tbl, 'insert into public.' || tbl || ' default values')
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
select t.denied('anon cannot update ' || tbl, 'update public.' || tbl || ' set user_id = user_id')
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
select t.denied('anon cannot delete from ' || tbl, 'delete from public.' || tbl)
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
select t.denied('anon cannot truncate ' || tbl, 'truncate public.' || tbl)
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
select t.denied('anon cannot select from ' || tbl || ' even carrying the owner''s sub claim',
  'set request.jwt.claims to ''{"sub":"00000000-0000-4000-8000-000000000001"}''; select * from public.' || tbl)
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;

-- TRUNCATE is not covered by RLS, so it must be a missing privilege: no signed-in user has it.
:as_owner;
select t.denied('allow-listed owner cannot truncate ' || tbl, 'truncate public.' || tbl)
from unnest(array['allowed_users','session_checkins','races','plan_sessions','phase_blocks','sheet_import']) tbl;
:as_super;
select t.is('the fixtures were all still there after the truncate attempts',
  (select count(*) from public.session_checkins) + (select count(*) from public.races), 7::bigint);
