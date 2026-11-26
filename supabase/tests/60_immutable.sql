-- AC7: columns and operations the database refuses, even to the allow-listed owner.
\ir lib.sql
\ir fixtures.sql
set t.file = '60_immutable';

:as_owner;
-- plan_sessions: id, plan_date, user_id, created_at (and seq) are fixed once inserted.
select t.denied('owner cannot update plan_sessions.id', $q$update public.plan_sessions set id = 'moved' where id = 'o-p1'$q$);
select t.denied('owner cannot update plan_sessions.plan_date', $q$update public.plan_sessions set plan_date = '2030-01-01' where id = 'o-p1'$q$);
select t.denied('owner cannot update plan_sessions.plan_date to the same value', $q$update public.plan_sessions set plan_date = plan_date where id = 'o-p1'$q$);
select t.denied('owner cannot update plan_sessions.user_id (to second''s id)', $q$update public.plan_sessions set user_id = '00000000-0000-4000-8000-000000000002' where id = 'o-p1'$q$);
select t.denied('owner cannot update plan_sessions.user_id to its own value', $q$update public.plan_sessions set user_id = user_id where id = 'o-p1'$q$);
select t.denied('owner cannot update plan_sessions.created_at', $q$update public.plan_sessions set created_at = now() where id = 'o-p1'$q$);
select t.throws('owner cannot set plan_sessions.seq to a value (GENERATED ALWAYS)', $q$update public.plan_sessions set seq = 999 where id = 'o-p1'$q$, '428C9', 'only be updated to DEFAULT');
select t.denied('owner cannot even set plan_sessions.seq = DEFAULT (no column grant)', $q$update public.plan_sessions set seq = default where id = 'o-p1'$q$);
select t.denied('a legal column plus plan_date in one statement is refused as a whole', $q$update public.plan_sessions set title = 'x', plan_date = '2030-01-01' where id = 'o-p1'$q$);
select t.is('plan_sessions row is untouched after the refused updates',
  (select id || '/' || plan_date || '/' || title from public.plan_sessions where id = 'o-p1'), 'o-p1/2026-11-02/Easy run');

-- phase_blocks: from_date and phase CAN change (a block can be moved or renamed); the rest cannot.
select t.is('owner can update phase_blocks.from_date', t.rows($q$update public.phase_blocks set from_date = '2026-11-08' where id = 'o-ph1'$q$), 1::bigint);
select t.is('owner can update phase_blocks.phase', t.rows($q$update public.phase_blocks set phase = 'taper' where id = 'o-ph1'$q$), 1::bigint);
select t.denied('owner cannot update phase_blocks.id', $q$update public.phase_blocks set id = 'moved' where id = 'o-ph1'$q$);
select t.denied('owner cannot update phase_blocks.user_id', $q$update public.phase_blocks set user_id = '00000000-0000-4000-8000-000000000002' where id = 'o-ph1'$q$);
select t.denied('owner cannot update phase_blocks.created_at', $q$update public.phase_blocks set created_at = now() where id = 'o-ph1'$q$);
select t.throws('owner cannot set phase_blocks.seq to a value (GENERATED ALWAYS)', $q$update public.phase_blocks set seq = 999 where id = 'o-ph1'$q$, '428C9', 'only be updated to DEFAULT');
select t.denied('owner cannot even set phase_blocks.seq = DEFAULT (no column grant)', $q$update public.phase_blocks set seq = default where id = 'o-ph1'$q$);

-- session_checkins and races: no update at all (any column); session_checkins: no delete either.
select t.denied('owner cannot update session_checkins.note', $q$update public.session_checkins set note = 'x' where id = 'o-s1'$q$);
select t.denied('owner cannot update session_checkins.a1', $q$update public.session_checkins set a1 = 'x' where id = 'o-s1'$q$);
select t.denied('owner cannot update session_checkins.session_date', $q$update public.session_checkins set session_date = '2030-01-01' where id = 'o-s1'$q$);
select t.denied('owner cannot update session_checkins.user_id', $q$update public.session_checkins set user_id = user_id where id = 'o-s1'$q$);
select t.denied('owner cannot delete from session_checkins by id', $q$delete from public.session_checkins where id = 'o-s1'$q$);
select t.denied('owner cannot delete from session_checkins (unfiltered)', $q$delete from public.session_checkins$q$);
select t.denied('owner cannot update races.name', $q$update public.races set name = 'x' where id = 'o-r1'$q$);
select t.denied('owner cannot update races.status', $q$update public.races set status = 'locked' where id = 'o-r1'$q$);
select t.denied('owner cannot update races.user_id', $q$update public.races set user_id = user_id where id = 'o-r1'$q$);
select t.is('races can still be deleted (the app edits a race by delete + add)', t.rows($q$delete from public.races where id = 'o-r1'$q$), 1::bigint);

-- sheet_import: written once. No update, no delete, and a second insert conflicts.
select t.denied('owner cannot update sheet_import.counts', $q$update public.sheet_import set counts = '{}'$q$);
select t.denied('owner cannot update sheet_import.completed_at', $q$update public.sheet_import set completed_at = now()$q$);
select t.denied('owner cannot update sheet_import.user_id', $q$update public.sheet_import set user_id = '00000000-0000-4000-8000-000000000002'$q$);
select t.denied('owner cannot delete the sheet_import marker', $q$delete from public.sheet_import$q$);
select t.throws('a second sheet_import insert for the owner conflicts (23505)',
  $q$insert into public.sheet_import (counts) values ('{"sessions":5}')$q$, '23505', 'duplicate key');
select t.is('sheet_import marker unchanged', (select counts->>'sessions' from public.sheet_import), '2');

-- allowed_users: select only.
select t.denied('owner cannot update allowed_users', $q$update public.allowed_users set note = 'x'$q$);
