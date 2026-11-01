-- Shared by every test file: stop on the first unexpected error, who the test users are, and
-- one-line macros to act as each of them. Use as:   :as_owner   select ... ;   :as_super
\set ON_ERROR_STOP on
\set QUIET on

\set owner_id    '00000000-0000-4000-8000-000000000001'
\set second_id   '00000000-0000-4000-8000-000000000002'
\set stranger_id '00000000-0000-4000-8000-000000000003'

-- The superuser (what the Supabase SQL editor runs as). Not subject to RLS.
\set as_super    'reset role; reset request.jwt.claims; select 1 as _ where false'
-- A signed-in user: the authenticated role, with the user's id in the JWT claims.
\set as_owner    'reset role; set role authenticated; set request.jwt.claims to ''{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}''; select 1 as _ where false'
\set as_second   'reset role; set role authenticated; set request.jwt.claims to ''{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}''; select 1 as _ where false'
\set as_stranger 'reset role; set role authenticated; set request.jwt.claims to ''{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}''; select 1 as _ where false'
-- Not signed in at all: the anon role, no claims.
\set as_anon     'reset role; set role anon; reset request.jwt.claims; select 1 as _ where false'
