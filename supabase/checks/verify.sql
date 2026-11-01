-- Read-only check for the owner: run this in the Supabase SQL editor AFTER applying the six migrations.
-- It changes nothing (selects only). supabase/README.md says when to run it and what to expect.
--
-- Part 1: every table in public, with row-level security on or off.
-- Expect: rls_enabled = true for EVERY row. A table with false is readable and writable by anyone
-- holding the public key (subject to its grants), so stop and fix it before going on.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;

-- Part 2: what each API role may do on each of the six tables, per privilege.
-- Expect: the anon column is false everywhere; the authenticated column is true only where the grant
-- matrix in supabase/README.md says so. Note TRUNCATE, REFERENCES and TRIGGER: row-level security does
-- not cover them, so they must be false for both roles.
select t.table_name,
       p.privilege,
       has_table_privilege('anon', 'public.' || t.table_name, p.privilege) as anon,
       has_table_privilege('authenticated', 'public.' || t.table_name, p.privilege) as authenticated
from (values ('allowed_users'), ('session_checkins'), ('races'), ('plan_sessions'), ('phase_blocks'), ('sheet_import')) as t(table_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(privilege)
order by t.table_name, array_position(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'], p.privilege);

-- Part 3: column-level UPDATE, which is how the plan date is kept fixed. Expect exactly these:
--   plan_sessions: disc, title, intensity, duration, is_key, notes, phase   (NOT plan_date, id, user_id)
--   phase_blocks:  from_date, phase                                          (NOT id, user_id)
select c.table_name, c.column_name
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('plan_sessions', 'phase_blocks')
  and has_column_privilege('authenticated', 'public.' || c.table_name, c.column_name, 'UPDATE')
order by c.table_name, c.ordinal_position;

-- Part 4: the policies. Expect each data-table policy to name the allow-list (a subquery on allowed_users)
-- as well as user_id = auth.uid(), and every policy to be "to authenticated" only.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- Part 5: anything else in public that the API could expose (functions, views). There should be none yet.
-- Expect: no rows. (When the Garmin step adds functions, revoke the default EXECUTE grant first: see README.)
select 'function' as kind, p.proname as name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'view', c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm');
