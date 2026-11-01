-- AC6: a signed-in Google account that is NOT in allowed_users sees nothing and writes nothing,
-- cannot edit the allow-list, and loses access the moment their row leaves the list.
\ir lib.sql
\ir fixtures.sql
set t.file = '50_allowlist';

:as_stranger;
-- The stranger has rows in every data table (inserted by the fixtures as superuser, under their
-- own user_id). The user_id test alone would show them; only the allow-list test hides them.
select t.is('stranger sees 0 session_checkins', (select count(*) from public.session_checkins), 0::bigint);
select t.is('stranger sees 0 races', (select count(*) from public.races), 0::bigint);
select t.is('stranger sees 0 plan_sessions', (select count(*) from public.plan_sessions), 0::bigint);
select t.is('stranger sees 0 phase_blocks', (select count(*) from public.phase_blocks), 0::bigint);
select t.is('stranger sees 0 sheet_import', (select count(*) from public.sheet_import), 0::bigint);

select t.rls_rejected('stranger cannot insert into session_checkins',
  $q$insert into public.session_checkins (id, session_date) values ('s-1','2026-10-01')$q$);
select t.rls_rejected('stranger cannot insert into races',
  $q$insert into public.races (id, name, race_date) values ('s-1','x','2027-01-01')$q$);
select t.rls_rejected('stranger cannot insert into plan_sessions',
  $q$insert into public.plan_sessions (id, plan_date) values ('s-1','2026-10-01')$q$);
select t.rls_rejected('stranger cannot insert into phase_blocks',
  $q$insert into public.phase_blocks (id, from_date, phase) values ('s-1','2026-10-01','base')$q$);
select t.rls_rejected('stranger cannot insert into sheet_import',
  $q$insert into public.sheet_import (counts) values ('{}')$q$);
select t.rls_rejected('stranger cannot insert with an explicit user_id of their own either',
  $q$insert into public.races (user_id, id, name, race_date) values ('00000000-0000-4000-8000-000000000003','s-2','x','2027-01-01')$q$);

select t.is('stranger updates their own plan_sessions row -> 0 rows', t.rows($q$update public.plan_sessions set title = 'x' where id = 'z-p1'$q$), 0::bigint);
select t.is('stranger updates their own phase_blocks row -> 0 rows', t.rows($q$update public.phase_blocks set phase = 'x' where id = 'z-ph1'$q$), 0::bigint);
select t.is('stranger deletes their own race -> 0 rows', t.rows($q$delete from public.races where id = 'z-r1'$q$), 0::bigint);

-- The allow-list itself: read-only, own row only, nobody can add themselves.
select t.is('stranger reads 0 rows of allowed_users', (select count(*) from public.allowed_users), 0::bigint);
select t.denied('stranger cannot add themselves to allowed_users',
  $q$insert into public.allowed_users (user_id, note) values ('00000000-0000-4000-8000-000000000003','me')$q$);
select t.denied('stranger cannot insert into allowed_users using the default user_id',
  $q$insert into public.allowed_users (note) values ('me')$q$);
select t.denied('stranger cannot update allowed_users', $q$update public.allowed_users set note = 'x'$q$);
select t.denied('stranger cannot delete from allowed_users', $q$delete from public.allowed_users$q$);

:as_owner;
select t.is('owner reads exactly 1 row of allowed_users (their own, not second''s)', (select count(*) from public.allowed_users), 1::bigint);
select t.is('...and it is theirs', (select string_agg(user_id::text, ',') from public.allowed_users), :'owner_id');
select t.denied('allow-listed owner cannot add someone to allowed_users',
  $q$insert into public.allowed_users (user_id, note) values ('00000000-0000-4000-8000-000000000003','sneaky')$q$);
select t.denied('allow-listed owner cannot update allowed_users', $q$update public.allowed_users set note = 'x'$q$);
select t.denied('allow-listed owner cannot delete from allowed_users', $q$delete from public.allowed_users$q$);

-- Positive control: put the stranger on the list and the same rows appear. This proves the
-- zeros above come from the allow-list and not from a broken fixture or predicate.
:as_super;
insert into public.allowed_users (user_id, note) values (:'stranger_id', 'temp');
:as_stranger;
select t.is('control: once allow-listed, stranger sees their own session_checkins', (select count(*) from public.session_checkins), 1::bigint);
select t.is('control: once allow-listed, stranger sees their own races', (select count(*) from public.races), 1::bigint);
select t.is('control: once allow-listed, stranger sees their own plan_sessions', (select count(*) from public.plan_sessions), 1::bigint);
select t.is('control: once allow-listed, stranger sees their own phase_blocks', (select count(*) from public.phase_blocks), 1::bigint);
select t.is('control: once allow-listed, stranger sees their own sheet_import', (select count(*) from public.sheet_import), 1::bigint);
select t.is('control: once allow-listed, stranger can insert', t.rows($q$insert into public.races (id, name, race_date) values ('s-3','x','2027-01-01')$q$), 1::bigint);

-- Removal takes effect immediately: remove the OWNER from the list and they lose everything.
:as_super;
delete from public.allowed_users where user_id = :'owner_id';
:as_owner;
select t.is('removed from the list: owner sees 0 session_checkins', (select count(*) from public.session_checkins), 0::bigint);
select t.is('removed from the list: owner sees 0 races', (select count(*) from public.races), 0::bigint);
select t.is('removed from the list: owner sees 0 plan_sessions', (select count(*) from public.plan_sessions), 0::bigint);
select t.is('removed from the list: owner sees 0 phase_blocks', (select count(*) from public.phase_blocks), 0::bigint);
select t.is('removed from the list: owner sees 0 sheet_import', (select count(*) from public.sheet_import), 0::bigint);
select t.rls_rejected('removed from the list: owner cannot insert',
  $q$insert into public.session_checkins (id, session_date) values ('late-1','2026-10-01')$q$);
select t.is('removed from the list: owner update touches 0 rows', t.rows($q$update public.plan_sessions set title = 'x'$q$), 0::bigint);
select t.is('removed from the list: owner delete touches 0 rows', t.rows($q$delete from public.races$q$), 0::bigint);
