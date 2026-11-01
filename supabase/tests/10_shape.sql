-- AC2: every table's columns, types, nullability, defaults, keys and check constraints are
-- exactly what the spec says. Anything extra or missing shows up as a failure.
\ir lib.sql
set t.file = '10_shape';
:as_super;

-- Expected columns: table, column, type, not null?, default expression, identity kind.
create temp table want_cols (tbl text, col text, typ text, nn boolean, dflt text, ident text);
insert into want_cols values
  ('allowed_users','user_id','uuid',true,null,''),
  ('allowed_users','note','text',false,null,''),
  ('allowed_users','created_at','timestamp with time zone',true,'now()',''),

  ('session_checkins','user_id','uuid',true,'auth.uid()',''),
  ('session_checkins','id','text',true,null,''),
  ('session_checkins','seq','bigint',true,null,'a'),
  ('session_checkins','created_at','timestamp with time zone',true,'now()',''),
  ('session_checkins','session_date','date',true,null,''),
  ('session_checkins','disc','text',true,'''''::text',''),
  ('session_checkins','duration','integer',false,null,''),
  ('session_checkins','intensity','text',true,'''''::text',''),
  ('session_checkins','rpe','integer',false,null,''),
  ('session_checkins','a1','text',false,null,''),
  ('session_checkins','a2','text',false,null,''),
  ('session_checkins','a3','text',false,null,''),
  ('session_checkins','b2','text',false,null,''),
  ('session_checkins','b3','text',false,null,''),
  ('session_checkins','note','text',true,'''''::text',''),
  ('session_checkins','phase','text',false,null,''),
  ('session_checkins','logged_at','timestamp with time zone',false,null,''),

  ('races','user_id','uuid',true,'auth.uid()',''),
  ('races','id','text',true,null,''),
  ('races','seq','bigint',true,null,'a'),
  ('races','created_at','timestamp with time zone',true,'now()',''),
  ('races','name','text',true,null,''),
  ('races','race_date','date',true,null,''),
  ('races','url','text',true,'''''::text',''),
  ('races','notes','text',true,'''''::text',''),
  ('races','status','text',true,'''considering''::text',''),

  ('plan_sessions','user_id','uuid',true,'auth.uid()',''),
  ('plan_sessions','id','text',true,null,''),
  ('plan_sessions','seq','bigint',true,null,'a'),
  ('plan_sessions','created_at','timestamp with time zone',true,'now()',''),
  ('plan_sessions','plan_date','date',true,null,''),
  ('plan_sessions','disc','text',true,'''''::text',''),
  ('plan_sessions','title','text',true,'''''::text',''),
  ('plan_sessions','intensity','text',true,'''''::text',''),
  ('plan_sessions','duration','integer',false,null,''),
  ('plan_sessions','is_key','boolean',true,'false',''),
  ('plan_sessions','notes','text',true,'''''::text',''),
  ('plan_sessions','phase','text',true,'''''::text',''),

  ('phase_blocks','user_id','uuid',true,'auth.uid()',''),
  ('phase_blocks','id','text',true,null,''),
  ('phase_blocks','seq','bigint',true,null,'a'),
  ('phase_blocks','created_at','timestamp with time zone',true,'now()',''),
  ('phase_blocks','from_date','date',true,null,''),
  ('phase_blocks','phase','text',true,null,''),

  ('sheet_import','user_id','uuid',true,'auth.uid()',''),
  ('sheet_import','completed_at','timestamp with time zone',true,'now()',''),
  ('sheet_import','counts','jsonb',true,null,'');

create temp table have_cols as
select c.relname::text as tbl, a.attname::text as col, format_type(a.atttypid, a.atttypmod) as typ,
       a.attnotnull as nn, pg_get_expr(d.adbin, d.adrelid) as dflt, a.attidentity::text as ident
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where c.relkind in ('r', 'p');

select t.is('column set per table is exactly the spec (no extra, no missing)',
  (select count(*) from (
     (select tbl, col from want_cols except select tbl, col from have_cols)
     union all
     (select tbl, col from have_cols except select tbl, col from want_cols)) d),
  0::bigint);

select t.ok('column ' || w.tbl || '.' || w.col || ' is ' || w.typ
            || case when w.nn then ' not null' else ' null' end
            || coalesce(' default ' || w.dflt, '') || case when w.ident = 'a' then ' generated always as identity' else '' end,
  h.typ = w.typ and h.nn = w.nn and h.dflt is not distinct from w.dflt and h.ident = w.ident)
from want_cols w left join have_cols h using (tbl, col);

-- Tables: exactly the six, nothing else in public (so a stray table cannot hide).
select t.is('public holds exactly the six spec tables',
  (select string_agg(relname, ',' order by relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')),
  'allowed_users,phase_blocks,plan_sessions,races,session_checkins,sheet_import');

-- Primary keys.
create temp table want_pk (tbl text, def text);
insert into want_pk values
  ('allowed_users', 'PRIMARY KEY (user_id)'),
  ('session_checkins', 'PRIMARY KEY (user_id, id)'),
  ('races', 'PRIMARY KEY (user_id, id)'),
  ('plan_sessions', 'PRIMARY KEY (user_id, id)'),
  ('phase_blocks', 'PRIMARY KEY (user_id, id)'),
  ('sheet_import', 'PRIMARY KEY (user_id)');
select t.is('primary key of ' || w.tbl,
  (select pg_get_constraintdef(k.oid) from pg_constraint k where k.conrelid = ('public.' || w.tbl)::regclass and k.contype = 'p'),
  w.def)
from want_pk w;

-- Foreign keys: exactly one per table (user_id -> auth.users(id)), with NO cascade (D5).
select t.is('foreign key of ' || w.tbl || ' is user_id -> auth.users(id) with no ON DELETE action',
  (select string_agg(pg_get_constraintdef(k.oid), ' | ') from pg_constraint k where k.conrelid = ('public.' || w.tbl)::regclass and k.contype = 'f'),
  'FOREIGN KEY (user_id) REFERENCES auth.users(id)')
from want_pk w;

-- Check constraints: only races.status has one.
select t.is('check constraints in public are exactly one: races.status',
  (select string_agg(k.conrelid::regclass::text || ':' || k.conname, ',' order by k.conname)
     from pg_constraint k join pg_namespace n on n.oid = k.connamespace
     where n.nspname = 'public' and k.contype = 'c'),
  'races:races_status_check');
select t.ok('races.status check names considering and locked and nothing else',
  (select pg_get_constraintdef(k.oid) from pg_constraint k where k.conname = 'races_status_check') ~ 'considering.*locked'
  and (select pg_get_constraintdef(k.oid) from pg_constraint k where k.conname = 'races_status_check') !~ 'ARRAY\[[^]]*,[^]]*,');

-- No other indexes, triggers or rules: only the primary-key indexes.
select t.is('indexes in public are only the six primary keys',
  (select count(*) from pg_indexes where schemaname = 'public'), 6::bigint);
select t.is('indexes in public that are not primary keys',
  (select count(*) from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not i.indisprimary), 0::bigint);
select t.is('user triggers in public', (select count(*) from pg_trigger where not tgisinternal), 0::bigint);
select t.is('functions in public', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'), 0::bigint);

-- Behavioural check of the status constraint, as the superuser (privileges are not the point).
select t.throws('races.status rejects an unknown value',
  $q$insert into public.races (user_id, id, name, race_date, status) values ('00000000-0000-4000-8000-000000000001','chk-1','n','2027-01-01','maybe')$q$,
  '23514', 'races_status_check');
select t.ok('races.status accepts considering and locked',
  t.rows($q$insert into public.races (user_id, id, name, race_date, status) values
    ('00000000-0000-4000-8000-000000000001','chk-2','n','2027-01-01','considering'),
    ('00000000-0000-4000-8000-000000000001','chk-3','n','2027-01-01','locked')$q$) = 2);
select t.ok('disc/intensity/phase accept out-of-list values (decision 31)',
  t.rows($q$insert into public.plan_sessions (user_id, id, plan_date, disc, intensity, phase) values
    ('00000000-0000-4000-8000-000000000001','chk-4','2027-01-01','kayak','tempo-ish','offseason')$q$) = 1);
