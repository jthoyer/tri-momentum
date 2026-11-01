#!/usr/bin/env bash
# Runs the database tests for supabase/migrations/ against a throwaway PostgreSQL cluster.
#
#   supabase/tests/run.sh
#
# What it does, in order:
#   1. Lints the migrations (six files, right names and order, nothing destructive).
#   2. Creates a temporary cluster in a temp directory (unix socket only, no network).
#   3. Recreates what the migrations expect from Supabase: the anon / authenticated /
#      service_role roles, a stub auth schema with auth.users and auth.uid(), and Supabase's
#      DEFAULT PRIVILEGES (ALL, including TRUNCATE, granted to anon and authenticated on every
#      new table in public). Without that last part the revoke tests would pass vacuously.
#   4. Applies the migrations in filename order with ON_ERROR_STOP.
#   5. Runs the assertion files (NN_*.sql), each in its own psql session on fresh fixtures.
#   6. Stops and deletes the cluster, prints the totals, and exits non-zero on any failure.
#
# Needs PostgreSQL 16 binaries (initdb, pg_ctl, postgres) and psql. Override with:
#   PG_BIN=/path/to/bin           default /usr/lib/postgresql/16/bin
#   MIGRATIONS_DIR=/path/to/dir   default ../migrations (used to test a mutated copy)
#   VERBOSE=1                     list every assertion, not just failures
#
# initdb refuses to run as root. When this script is run as root it starts the server as the
# `postgres` OS user; psql still runs as you.
#
# Nothing here touches a real Supabase project: there is no network connection of any kind.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$HERE/../migrations}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
VERBOSE="${VERBOSE:-0}"

FAILED=0
fail() { echo "FAIL: $*" >&2; FAILED=1; }

for b in initdb pg_ctl; do
  [ -x "$PG_BIN/$b" ] || { echo "error: $PG_BIN/$b not found (set PG_BIN)" >&2; exit 2; }
done
command -v psql >/dev/null || { echo "error: psql not found on PATH" >&2; exit 2; }
command -v perl >/dev/null || { echo "error: perl not found on PATH" >&2; exit 2; }

# ---------------------------------------------------------------- 1. lint the migrations
echo "== migrations lint ($MIGRATIONS_DIR)"
mapfile -t FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | LC_ALL=C sort)
EXPECTED=(allowed_users session_checkins races plan_sessions phase_blocks sheet_import)
if [ "${#FILES[@]}" -ne "${#EXPECTED[@]}" ]; then
  fail "expected ${#EXPECTED[@]} migration files, found ${#FILES[@]}"
fi
for i in "${!EXPECTED[@]}"; do
  f="${FILES[$i]:-}"
  base="$(basename "$f")"
  if ! [[ "$base" =~ ^[0-9]{14}_${EXPECTED[$i]}\.sql$ ]]; then
    fail "migration #$((i + 1)) should be YYYYMMDDHHMMSS_${EXPECTED[$i]}.sql (allow-list first), found '$base'"
  fi
done
for f in "${FILES[@]}"; do
  head -n1 "$f" | grep -q '^--' || fail "$(basename "$f") should start with a header comment"
  # Comments are removed first, so prose may use the words. "delete" is allowed as a privilege
  # and as a policy command (the grants need it); what is refused is a DELETE statement.
  perl -0777 -ne '
    s{/\*.*?\*/}{}gs; s{--[^\n]*}{}g; my $bad = 0;
    for my $s (split /;/) {
      $s =~ s/^\s+//;
      if ($s =~ /\bdrop\b/i)             { print "  contains DROP: ", substr($s, 0, 70), "\n"; $bad = 1 }
      if ($s =~ /\btruncate\b/i)         { print "  contains TRUNCATE: ", substr($s, 0, 70), "\n"; $bad = 1 }
      if ($s =~ /^delete\b/i)            { print "  contains a DELETE statement: ", substr($s, 0, 70), "\n"; $bad = 1 }
      if ($s =~ /^alter\b.*\brename\b/is){ print "  contains ALTER ... RENAME: ", substr($s, 0, 70), "\n"; $bad = 1 }
    }
    exit $bad;' "$f" || fail "$(basename "$f") contains a forbidden statement"
done
[ "$FAILED" = 0 ] && echo "ok: ${#FILES[@]} files, names and order correct, no drop/delete/truncate/rename"

# ---------------------------------------------------------------- 2. throwaway cluster
TMP="$(mktemp -d /tmp/tri-sql-XXXXXX)"
AS_PG=()
if [ "$(id -u)" = 0 ]; then
  id postgres >/dev/null 2>&1 || { echo "error: running as root needs an OS user named postgres" >&2; rm -rf "$TMP"; exit 2; }
  chown postgres "$TMP"
  AS_PG=(runuser -u postgres --)
fi
chmod 700 "$TMP"

cleanup() {
  cd /tmp || true
  "${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

cd /tmp || exit 2
echo "== starting a throwaway cluster in $TMP"
"${AS_PG[@]}" "$PG_BIN/initdb" -D "$TMP/data" -U postgres --auth=trust -E UTF8 --no-locale >"$TMP/initdb.log" 2>&1 \
  || { cat "$TMP/initdb.log" >&2; exit 2; }
"${AS_PG[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -w \
  -o "-c listen_addresses= -c unix_socket_directories=$TMP -c port=5432 -c fsync=off -c max_connections=20" start >/dev/null \
  || { cat "$TMP/server.log" >&2; exit 2; }

psql_run() { psql -X -q -t -A -h "$TMP" -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

# ---------------------------------------------------------------- 3 + 4. setup, migrations
echo "== recreating Supabase's roles, auth stub and default privileges"
psql_run -f "$HERE/00_setup.sql" >/dev/null || { fail "00_setup.sql"; exit 1; }
echo "== applying migrations in filename order"
for f in "${FILES[@]}"; do
  if psql_run -f "$f" >/dev/null; then echo "applied $(basename "$f")"; else fail "applying $(basename "$f")"; fi
done
[ "$FAILED" = 0 ] || { echo "== migrations did not apply cleanly; not running the tests"; exit 1; }

# ---------------------------------------------------------------- 5. assertion files
echo "== running assertions"
for t in "$HERE"/[0-9][0-9]_*.sql; do
  name="$(basename "$t")"
  [ "$name" = "00_setup.sql" ] && continue
  if ! psql_run -f "$t" >"$TMP/out.txt" 2>&1; then
    fail "$name stopped on an unexpected error:"
    sed 's/^/    /' "$TMP/out.txt" >&2
  fi
done

# ---------------------------------------------------------------- 6. report
if [ "$VERBOSE" = 1 ]; then
  psql_run -F ' | ' -c "select case when ok then 'pass' else 'FAIL' end, file, name from t.results order by n"
fi
echo "== results per file"
psql_run -F ' ' -c "select rpad(coalesce(file, '?'), 16) || ' pass ' || count(*) filter (where ok) || '  fail ' || count(*) filter (where not ok) from t.results group by file order by file"
FILES_RUN="$(psql_run -c "select count(distinct file) from t.results")"
EXPECTED_FILES="$(ls "$HERE"/[0-9][0-9]_*.sql | grep -vc 00_setup)"
[ "$FILES_RUN" = "$EXPECTED_FILES" ] || fail "only $FILES_RUN of $EXPECTED_FILES assertion files recorded any result"
NFAIL="$(psql_run -c "select count(*) from t.results where not ok")"
NPASS="$(psql_run -c "select count(*) from t.results where ok")"
if [ "$NFAIL" != 0 ]; then
  echo "== failed assertions"
  psql_run -F ' | ' -c "select file, name, coalesce(detail, '') from t.results where not ok order by n"
  FAILED=1
fi
echo "== TOTAL: $NPASS passed, $NFAIL failed"
[ "$FAILED" = 0 ] && { echo "RESULT: ok"; exit 0; }
echo "RESULT: FAILED"
exit 1
