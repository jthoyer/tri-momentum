-- Known data, loaded as superuser at the start of each behaviour test file.
-- The owner and second user are on the allow-list; the stranger is not, but still has rows
-- carrying their own user_id (inserted as superuser) to prove the allow-list hides them.
reset role;
reset request.jwt.claims;

truncate public.sheet_import, public.phase_blocks, public.plan_sessions,
         public.races, public.session_checkins;
truncate public.allowed_users;

insert into public.allowed_users (user_id, note) values
  (:'owner_id', 'owner'),
  (:'second_id', 'second');

insert into public.session_checkins (user_id, id, session_date, disc) values
  (:'owner_id',    'o-s1', '2026-10-01', 'run'),
  (:'owner_id',    'o-s2', '2026-10-02', 'bike'),
  (:'second_id',   'x-s1', '2026-10-01', 'swim'),
  (:'stranger_id', 'z-s1', '2026-10-01', 'run');

insert into public.races (user_id, id, name, race_date) values
  (:'owner_id',    'o-r1', 'Owner Olympic',    '2027-03-01'),
  (:'second_id',   'x-r1', 'Second Sprint',    '2027-03-01'),
  (:'stranger_id', 'z-r1', 'Stranger 70.3',    '2027-03-01');

insert into public.plan_sessions (user_id, id, plan_date, disc, title) values
  (:'owner_id',    'o-p1', '2026-11-02', 'run',  'Easy run'),
  (:'owner_id',    'o-p2', '2026-11-03', 'bike', 'Long ride'),
  (:'second_id',   'x-p1', '2026-11-02', 'swim', 'Swim set'),
  (:'stranger_id', 'z-p1', '2026-11-02', 'run',  'Stranger run');

insert into public.phase_blocks (user_id, id, from_date, phase) values
  (:'owner_id',    'o-ph1', '2026-11-01', 'base'),
  (:'owner_id',    'legacy', '2026-01-01', 'base'),
  (:'second_id',   'legacy', '2026-01-01', 'build1'),
  (:'stranger_id', 'z-ph1', '2026-11-01', 'base');

insert into public.sheet_import (user_id, counts) values
  (:'owner_id',    '{"sessions":2}'),
  (:'stranger_id', '{"sessions":1}');
