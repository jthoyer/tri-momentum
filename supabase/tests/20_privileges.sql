-- AC3: RLS on every table in public; anon and PUBLIC hold nothing; authenticated holds exactly
-- the grant matrix and nothing more (no TRUNCATE, REFERENCES or TRIGGER).
\ir lib.sql
set t.file = '20_privileges';
:as_super;

-- 1. The harness really starts from Supabase's default privileges. A scratch table made now
--    must be wide open to anon and authenticated; if it is not, every revoke test below would
--    pass without proving anything. (Rolled back, so nothing is left behind.)
begin;
create table public._defaults_probe (x int);
select bool_and(has_table_privilege(r, 'public._defaults_probe', p)) as probe_ok
from unnest(array['anon','authenticated']) r,
     unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
\gset
rollback;
select t.ok('harness: a new public table starts with ALL privileges (incl. TRUNCATE) for anon and authenticated', :'probe_ok'::boolean);

-- 2. RLS is on for EVERY table in public, not just a known list.
select t.is('tables in public with RLS disabled',
  (select coalesce(string_agg(c.relname, ','), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity), '');
select t.ok('RLS is enabled on ' || c.relname, c.relrowsecurity)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p');

-- 3. The grant matrix (spec 5.3). Table-level privileges per table; UPDATE is column-level only.
create temp table tables_under_test (tbl text primary key);
insert into tables_under_test values
  ('allowed_users'), ('session_checkins'), ('races'), ('plan_sessions'), ('phase_blocks'), ('sheet_import');

create temp table want_table_priv (tbl text, priv text);
insert into want_table_priv values
  ('allowed_users','SELECT'),
  ('session_checkins','SELECT'), ('session_checkins','INSERT'),
  ('races','SELECT'), ('races','INSERT'), ('races','DELETE'),
  ('plan_sessions','SELECT'), ('plan_sessions','INSERT'), ('plan_sessions','DELETE'),
  ('phase_blocks','SELECT'), ('phase_blocks','INSERT'), ('phase_blocks','DELETE'),
  ('sheet_import','SELECT'), ('sheet_import','INSERT');

create temp table want_update_cols (tbl text, col text);
insert into want_update_cols values
  ('plan_sessions','disc'), ('plan_sessions','title'), ('plan_sessions','intensity'), ('plan_sessions','duration'),
  ('plan_sessions','is_key'), ('plan_sessions','notes'), ('plan_sessions','phase'),
  ('phase_blocks','from_date'), ('phase_blocks','phase');

create temp table all_privs (priv text);
insert into all_privs values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER');

-- authenticated, table level: every privilege on every table is either in the matrix or absent.
select t.is('authenticated ' || p.priv || ' on ' || x.tbl || ' (table level)',
  has_table_privilege('authenticated', 'public.' || x.tbl, p.priv),
  exists (select 1 from want_table_priv w where w.tbl = x.tbl and w.priv = p.priv))
from tables_under_test x cross join all_privs p
order by x.tbl, p.priv;

-- authenticated, column level: SELECT/INSERT follow the table grant; UPDATE only on the listed columns.
select t.is('authenticated ' || p.priv || ' on ' || x.tbl || '.' || a.attname || ' (column level)',
  has_column_privilege('authenticated', 'public.' || x.tbl, a.attname, p.priv),
  case p.priv
    when 'UPDATE' then exists (select 1 from want_update_cols u where u.tbl = x.tbl and u.col = a.attname)
    else exists (select 1 from want_table_priv w where w.tbl = x.tbl and w.priv = p.priv)
  end)
from tables_under_test x
join pg_attribute a on a.attrelid = ('public.' || x.tbl)::regclass and a.attnum > 0 and not a.attisdropped
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
order by x.tbl, a.attnum, p.priv;

-- anon: nothing at table level or column level, on any of the seven privileges.
select t.is('anon has no ' || p.priv || ' on ' || x.tbl,
  has_table_privilege('anon', 'public.' || x.tbl, p.priv), false)
from tables_under_test x cross join all_privs p
order by x.tbl, p.priv;
select t.is('anon has no column-level privilege anywhere on ' || x.tbl,
  has_any_column_privilege('anon', 'public.' || x.tbl, 'SELECT,INSERT,UPDATE,REFERENCES') , false)
from tables_under_test x;

-- PUBLIC (grantee 0 in the ACLs): nothing on a table or on any column.
select t.is('PUBLIC holds no table-level ACL entry on ' || x.tbl,
  (select count(*) from pg_class c, aclexplode(c.relacl) e where c.oid = ('public.' || x.tbl)::regclass and e.grantee = 0), 0::bigint)
from tables_under_test x;
select t.is('PUBLIC holds no column-level ACL entry on ' || x.tbl,
  (select count(*) from pg_attribute a, aclexplode(a.attacl) e where a.attrelid = ('public.' || x.tbl)::regclass and e.grantee = 0), 0::bigint)
from tables_under_test x;

-- Nobody but the owner, authenticated and service_role appears in any ACL, and authenticated
-- was not given the right to re-grant.
select t.is('ACL grantees on ' || x.tbl || ' are only postgres, authenticated, service_role',
  (select string_agg(distinct g, ',' order by g) from (
     select e.grantee::regrole::text as g from pg_class c, aclexplode(c.relacl) e where c.oid = ('public.' || x.tbl)::regclass
     union
     select e.grantee::regrole::text from pg_attribute a, aclexplode(a.attacl) e where a.attrelid = ('public.' || x.tbl)::regclass) s),
  'authenticated,postgres,service_role')
from tables_under_test x;
select t.is('authenticated holds no grant option on ' || x.tbl,
  (select count(*) from (
     select e.is_grantable from pg_class c, aclexplode(c.relacl) e where c.oid = ('public.' || x.tbl)::regclass and e.grantee = 'authenticated'::regrole
     union all
     select e.is_grantable from pg_attribute a, aclexplode(a.attacl) e where a.attrelid = ('public.' || x.tbl)::regclass and e.grantee = 'authenticated'::regrole) s
   where is_grantable), 0::bigint)
from tables_under_test x;

-- Sequences behind the identity columns: neither anon nor authenticated may touch them.
select t.is(r || ' has no privilege on identity sequence ' || c.relname,
  (has_sequence_privilege(r, c.oid, 'USAGE') or has_sequence_privilege(r, c.oid, 'SELECT') or has_sequence_privilege(r, c.oid, 'UPDATE')),
  false)
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
cross join unnest(array['anon','authenticated']) r
where c.relkind = 'S';

-- 4. RLS policies: exactly one per granted command, to authenticated only, nothing else.
create temp table want_policy (tbl text, cmd text);
insert into want_policy values
  ('allowed_users','SELECT'),
  ('session_checkins','SELECT'), ('session_checkins','INSERT'),
  ('races','SELECT'), ('races','INSERT'), ('races','DELETE'),
  ('plan_sessions','SELECT'), ('plan_sessions','INSERT'), ('plan_sessions','UPDATE'), ('plan_sessions','DELETE'),
  ('phase_blocks','SELECT'), ('phase_blocks','INSERT'), ('phase_blocks','UPDATE'), ('phase_blocks','DELETE'),
  ('sheet_import','SELECT'), ('sheet_import','INSERT');

select t.is('policies in public are exactly one per granted command',
  (select count(*) from (
     (select tbl, cmd from want_policy except select tablename::text, cmd::text from pg_policies where schemaname = 'public')
     union all
     (select tablename::text, cmd::text from pg_policies where schemaname = 'public' except select tbl, cmd from want_policy)) d),
  0::bigint);
select t.is('policies in public that are not PERMISSIVE and TO authenticated only',
  (select count(*) from pg_policies where schemaname = 'public' and (permissive <> 'PERMISSIVE' or roles <> '{authenticated}')), 0::bigint);
select t.is('no duplicate policy per table and command',
  (select count(*) from (select tablename, cmd from pg_policies where schemaname = 'public' group by 1, 2 having count(*) > 1) d), 0::bigint);

-- Every policy on a data table carries BOTH the own-row test and the allow-list test, in the
-- clause that applies to its command (USING for select/delete, WITH CHECK for insert, both for update).
-- The own-row test is matched as pg_policies prints it, "(user_id = ( SELECT auth.uid()", with the
-- "(" directly before user_id so that "a.user_id = ..." inside the allow-list subquery cannot satisfy it.
select t.ok('policy ' || p.policyname || ' tests user_id = auth.uid() and the allow-list',
  case p.cmd
    when 'SELECT' then p.qual ~ '\(user_id = \( SELECT auth\.uid\(\)' and p.qual ~ 'allowed_users'
    when 'DELETE' then p.qual ~ '\(user_id = \( SELECT auth\.uid\(\)' and p.qual ~ 'allowed_users'
    when 'INSERT' then p.with_check ~ '\(user_id = \( SELECT auth\.uid\(\)' and p.with_check ~ 'allowed_users'
    when 'UPDATE' then p.qual ~ '\(user_id = \( SELECT auth\.uid\(\)' and p.qual ~ 'allowed_users' and p.with_check ~ '\(user_id = \( SELECT auth\.uid\(\)' and p.with_check ~ 'allowed_users'
  end)
from pg_policies p
where p.schemaname = 'public' and p.tablename <> 'allowed_users';
select t.ok('allowed_users policy tests only user_id = auth.uid()',
  (select qual ~ '\(user_id = \( SELECT auth\.uid\(\)' and qual !~ 'allowed_users' from pg_policies where tablename = 'allowed_users'));
