-- Test-cluster setup: recreate the parts of Supabase that the migrations depend on.
-- Runs once, as the cluster superuser, before any migration is applied.
-- Nothing here is part of the product; it only exists so the migrations meet the same
-- starting state they meet on a real Supabase project.

-- Roles, as Supabase creates them. anon and authenticated cannot log in; the tests reach
-- them with SET ROLE. service_role bypasses RLS, like Supabase's.
create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

-- A stand-in for Supabase's auth schema: the users table the migrations reference, and an
-- auth.uid() that reads the request's JWT claims the way Supabase does (the newer
-- request.jwt.claims JSON setting first, falling back to the older request.jwt.claim.sub).
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Supabase lets the API roles use the public schema.
grant usage on schema public to anon, authenticated, service_role;

-- THE IMPORTANT PART. Supabase's default privileges: every new table, sequence and function
-- created in public by the postgres role is granted ALL to anon, authenticated and
-- service_role. ALL includes TRUNCATE, REFERENCES and TRIGGER, which row-level security does
-- not cover. If this were missing, a migration that forgot its REVOKE would still pass the
-- privilege tests, because there would be nothing to revoke.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- Three fake accounts (example.test addresses, made-up ids). owner and second go on the
-- allow-list; stranger has a Google sign-in but is not on it.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'second@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'stranger@example.test');

-- Assertion helpers, in their own schema so they cannot collide with the product's.
create schema t;
grant usage on schema t to public;

create table t.results (
  n      serial primary key,
  file   text,
  name   text not null,
  ok     boolean not null,
  detail text
);

-- Records one result. SECURITY DEFINER so it can write whichever role the test is running as.
create function t.record(p_name text, p_ok boolean, p_detail text) returns void
language sql security definer
as $$
  insert into t.results (file, name, ok, detail)
  values (current_setting('t.file', true), p_name, coalesce(p_ok, false), p_detail)
$$;

-- The helpers below are plpgsql on purpose: a plpgsql body is never inlined into the calling
-- query, so an argument such as t.rows('insert ...') is evaluated exactly once.
create function t.ok(p_name text, p_cond boolean) returns void
language plpgsql
as $$ begin perform t.record(p_name, p_cond, null); end $$;

create function t.is(p_name text, p_got anyelement, p_want anyelement) returns void
language plpgsql
as $$
begin
  perform t.record(
    p_name,
    p_got is not distinct from p_want,
    case when p_got is not distinct from p_want then null
         else 'got ' || coalesce(p_got::text, 'NULL') || ', want ' || coalesce(p_want::text, 'NULL') end
  );
end
$$;

-- Runs p_sql as the CURRENT role (SECURITY INVOKER, so RLS and privileges apply) and checks
-- that it fails with the given SQLSTATE and a message containing p_msg.
create function t.throws(p_name text, p_sql text, p_state text, p_msg text) returns void
language plpgsql
as $$
declare
  v_state text;
  v_msg   text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform t.record(
      p_name,
      v_state = p_state and v_msg like '%' || p_msg || '%',
      case when v_state = p_state and v_msg like '%' || p_msg || '%' then null
           else 'failed with ' || v_state || ': ' || v_msg || ' (wanted ' || p_state || ' / ' || p_msg || ')' end
    );
    return;
  end;
  perform t.record(p_name, false, 'no error was raised (wanted ' || p_state || ' / ' || p_msg || ')');
end
$$;

-- Privilege failure (no GRANT covers it).
create function t.denied(p_name text, p_sql text) returns void
language plpgsql
as $$ begin perform t.throws(p_name, p_sql, '42501', 'permission denied'); end $$;

-- Row-level-security failure (a policy's WITH CHECK rejected the row).
create function t.rls_rejected(p_name text, p_sql text) returns void
language plpgsql
as $$ begin perform t.throws(p_name, p_sql, '42501', 'row-level security'); end $$;

-- Runs p_sql as the current role and returns how many rows it touched or returned.
create function t.rows(p_sql text) returns bigint
language plpgsql
as $$
declare
  v_n bigint;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
