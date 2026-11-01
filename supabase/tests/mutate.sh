#!/usr/bin/env bash
# Mutation check for the SQL harness (supabase/tests/run.sh): proves the tests can fail.
#
#   supabase/tests/mutate.sh          (SHOW=5 to list more failing assertions per mutation)
#
# Works on scratch copies under /tmp only; the migrations and tests in the working tree are never edited.
# Each mutation: copy migrations (and tests), make ONE edit, confirm the edit changed the file, run the harness,
# report whether it went red and which assertions failed.
#
# Exit status: 1 if the baseline harness is red (mutation results would mean nothing); 1 if a mutation did not
# apply, or if any mutation other than M3 survives (exit=0), because that is a gap in the tests; 0 otherwise.
# The one expected survivor is M3 (PUBLIC holds nothing by default, so revoking from it changes nothing).
# M14 (drop user_id from plan_sessions_update_own WITH CHECK) is caught, but only by the structural policy-text
# check in 20_privileges.sql: no behavioural test can reach that condition, because user_id has no UPDATE grant.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN=$REPO/tests/run.sh
S=$(mktemp -d /tmp/mut-XXXXXX); trap 'rm -rf "$S"' EXIT
chmod 755 "$S"
BAD=0   # set to 1 by a mutation that did not apply, or survived and is not on the expected-survivor list
EXPECTED_SURVIVORS=" M3 "
mutate() { # label  file-glob  perl-expression  [tests-dir-mutation: 1]
  local label="$1" file="$2" expr="$3" where="${4:-mig}"
  rm -rf "$S/m" "$S/t"; mkdir -p "$S/m"; cp "$REPO"/migrations/*.sql "$S/m/"; cp -r "$REPO/tests" "$S/t"
  local target; if [ "$where" = mig ]; then target="$S/m/$file"; else target="$S/t/$file"; fi
  cp "$target" "$S/before"; perl -0777 -pi -e "$expr" "$target"
  if cmp -s "$S/before" "$target"; then echo "MUTATION DID NOT APPLY: $label"; BAD=1; return; fi
  out=$(MIGRATIONS_DIR="$S/m" "$S/t/run.sh" 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then
    local id="${label%% *}"
    case "$EXPECTED_SURVIVORS" in *" $id "*) echo "  (survivor $id is expected)";; *) echo "  SURVIVED: $id is not an expected survivor"; BAD=1;; esac
  fi
  nfail=$(echo "$out" | sed -n 's/^== TOTAL: .* \([0-9]*\) failed/\1/p')
  echo "[$label] exit=$rc failed_assertions=${nfail:-n/a}"
  echo "$out" | sed -n '/^== failed assertions/,/^== TOTAL/p' | grep '|' | head -${SHOW:-3} | sed 's/^/     /'
  echo "$out" | grep -E '^(FAIL|  contains)' | head -3 | sed 's/^/     /'
}
echo "--- baseline"; out=$("$RUN" 2>&1); base_rc=$?; echo "exit=$base_rc $(echo "$out" | grep TOTAL)"
if [ "$base_rc" -ne 0 ]; then echo "baseline harness is red: fix that first, mutation results would mean nothing" >&2; exit 1; fi
echo "--- revokes (AC3)"
mutate "M1 races: drop 'anon' from the revoke" 20261101000300_races.sql 's/revoke all on table public.races from public, anon, authenticated;/revoke all on table public.races from public, authenticated;/'
mutate "M2 races: drop 'authenticated' from the revoke" 20261101000300_races.sql 's/revoke all on table public.races from public, anon, authenticated;/revoke all on table public.races from public, anon;/'
mutate "M3 races: drop 'public' from the revoke (expected equivalent: PUBLIC holds nothing by default)" 20261101000300_races.sql 's/revoke all on table public.races from public, anon, authenticated;/revoke all on table public.races from anon, authenticated;/'
mutate "M4 races: delete the whole revoke line" 20261101000300_races.sql 's/revoke all on table public.races from public, anon, authenticated;\n//'
mutate "M5 races: grant truncate to authenticated" 20261101000300_races.sql 's/grant select, insert, delete on table public.races/grant select, insert, delete, truncate on table public.races/'
mutate "M6 races: remove the identity-sequence revoke" 20261101000300_races.sql 's/revoke all on sequence public.races_seq_seq from public, anon, authenticated;\n//'
mutate "M7 phase_blocks: remove ENABLE ROW LEVEL SECURITY" 20261101000500_phase_blocks.sql 's/alter table public.phase_blocks enable row level security;\n//'
echo "--- allow-list predicate (AC6) and own-row predicate (AC5), one condition at a time"
mutate "M8 races_select_own: drop the allow-list (exists) condition" 20261101000300_races.sql 's/(create policy races_select_own.*?using \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M9 races_select_own: drop the user_id condition" 20261101000300_races.sql 's/(create policy races_select_own.*?using \(\n)    user_id = \(select auth.uid\(\)\)\n    and (exists)/$1    $2/s'
mutate "M10 races_insert_own: drop the allow-list condition from WITH CHECK" 20261101000300_races.sql 's/(create policy races_insert_own.*?with check \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M11 races_insert_own: drop the user_id condition from WITH CHECK" 20261101000300_races.sql 's/(create policy races_insert_own.*?with check \(\n)    user_id = \(select auth.uid\(\)\)\n    and (exists)/$1    $2/s'
mutate "M12 races_delete_own: drop the allow-list condition" 20261101000300_races.sql 's/(create policy races_delete_own.*?using \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M13 plan_sessions_update_own: drop allow-list from WITH CHECK only" 20261101000400_plan_sessions.sql 's/(create policy plan_sessions_update_own.*?with check \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M14 plan_sessions_update_own: drop user_id from WITH CHECK only" 20261101000400_plan_sessions.sql 's/(create policy plan_sessions_update_own.*?with check \(\n)    user_id = \(select auth.uid\(\)\)\n    and (exists)/$1    $2/s'
mutate "M15 allowed_users select policy: using (true)" 20261101000100_allowed_users.sql 's/using \(user_id = \(select auth.uid\(\)\)\)/using (true)/'
mutate "M16 sheet_import_insert_own: drop allow-list from WITH CHECK" 20261101000600_sheet_import.sql 's/(create policy sheet_import_insert_own.*?with check \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M27 plan_sessions_delete_own: drop the allow-list condition" 20261101000400_plan_sessions.sql 's/(create policy plan_sessions_delete_own.*?using \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M28 plan_sessions_delete_own: drop the user_id condition" 20261101000400_plan_sessions.sql 's/(create policy plan_sessions_delete_own.*?using \(\n)    user_id = \(select auth.uid\(\)\)\n    and (exists)/$1    $2/s'
mutate "M29 phase_blocks_delete_own: drop the allow-list condition" 20261101000500_phase_blocks.sql 's/(create policy phase_blocks_delete_own.*?using \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M30 phase_blocks_update_own: drop the allow-list condition from USING" 20261101000500_phase_blocks.sql 's/(create policy phase_blocks_update_own.*?using \()\n    user_id = \(select auth.uid\(\)\)\n    and exists[^\n]*\n/$1\n    user_id = (select auth.uid())\n/s'
mutate "M31 phase_blocks_update_own: drop the user_id condition from USING" 20261101000500_phase_blocks.sql 's/(create policy phase_blocks_update_own.*?using \(\n)    user_id = \(select auth.uid\(\)\)\n    and (exists)/$1    $2/s'
echo "--- grants / immutability (AC7), shape (AC2)"
mutate "M17 plan_sessions: allow updating plan_date" 20261101000400_plan_sessions.sql 's/grant update \(disc,/grant update (plan_date, disc,/'
mutate "M18 phase_blocks: allow updating id" 20261101000500_phase_blocks.sql 's/grant update \(from_date, phase\)/grant update (id, from_date, phase)/'
mutate "M19 session_checkins: grant delete" 20261101000200_session_checkins.sql 's/grant select, insert on table public.session_checkins/grant select, insert, delete on table public.session_checkins/'
mutate "M20 sheet_import: grant update" 20261101000600_sheet_import.sql 's/grant select, insert on table public.sheet_import/grant select, insert, update on table public.sheet_import/'
mutate "M21 allowed_users: grant insert" 20261101000100_allowed_users.sql 's/grant select on table public.allowed_users/grant select, insert on table public.allowed_users/'
mutate "M22 races: add ON DELETE CASCADE to the user_id FK" 20261101000300_races.sql 's/references auth.users \(id\),/references auth.users (id) on delete cascade,/'
mutate "M23 races: drop the status check" 20261101000300_races.sql "s/ check \(status in \('considering', 'locked'\)\)//"
mutate "M24 races: seq GENERATED BY DEFAULT instead of ALWAYS" 20261101000300_races.sql 's/generated always as identity/generated by default as identity/'
echo "--- harness itself (not a migration): remove Supabase's default privileges for tables"
mutate "M25 setup: no default privileges on tables" 00_setup.sql 's/alter default privileges for role postgres in schema public\n  grant all on tables to anon, authenticated, service_role;\n//' tests
# M26: two edits at once - Supabase defaults removed from the harness AND the anon revoke removed from a migration.
rm -rf "$S/m" "$S/t"; mkdir -p "$S/m"; cp "$REPO"/migrations/*.sql "$S/m/"; cp -r "$REPO/tests" "$S/t"
perl -0777 -pi -e 's/alter default privileges for role postgres in schema public\n  grant all on tables to anon, authenticated, service_role;\n//' "$S/t/00_setup.sql"
perl -0777 -pi -e 's/revoke all on table public.races from public, anon, authenticated;/revoke all on table public.races from public, authenticated;/' "$S/m/20261101000300_races.sql"
out=$(MIGRATIONS_DIR="$S/m" "$S/t/run.sh" 2>&1); rc=$?
echo "[M26 no default privileges AND anon revoke missing] exit=$rc $(echo "$out" | grep TOTAL)"
echo "$out" | sed -n '/^== failed assertions/,/^== TOTAL/p' | grep '|' | sed 's/^/     /'
if [ "$rc" -eq 0 ]; then echo "  SURVIVED: M26 is not an expected survivor"; BAD=1; fi
if [ "$BAD" -ne 0 ]; then echo "RESULT: a mutation survived or did not apply (see above)" >&2; exit 1; fi
echo "RESULT: every mutation went red, except the expected survivor(s):$EXPECTED_SURVIVORS"
