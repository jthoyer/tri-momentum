#!/bin/bash
# Syncs Justin's personal agents/skills library (jthoyer/agent-skills-library)
# into this repo's .claude/ config so custom subagents (e.g. ux-designer) and
# any skills not already present are available from the start of the session,
# without asking Claude to attach the repo by hand each time.
#
# Idempotent: safe to re-run. Never overwrites an agent/skill that already
# exists under a name of its own in this repo (repo-specific config wins).
set -euo pipefail

# Only do this in Claude Code on the web / remote sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

LIB_REPO="https://github.com/jthoyer/agent-skills-library"
LIB_CACHE="/tmp/agent-skills-library-cache"
DEST_AGENTS="$CLAUDE_PROJECT_DIR/.claude/agents"
DEST_SKILLS="$CLAUDE_PROJECT_DIR/.claude/skills"

# Shallow clone (or refresh) a cache copy of the library. Failures here
# (offline, repo renamed, etc.) must never block the session from starting.
if [ -d "$LIB_CACHE/.git" ]; then
  git -C "$LIB_CACHE" fetch --depth 1 origin >/dev/null 2>&1 \
    && git -C "$LIB_CACHE" reset --hard origin/HEAD >/dev/null 2>&1 \
    || true
else
  rm -rf "$LIB_CACHE"
  git clone --depth 1 "$LIB_REPO" "$LIB_CACHE" >/dev/null 2>&1 || true
fi

if [ ! -d "$LIB_CACHE/.claude" ]; then
  echo "agent-skills-library sync skipped: cache clone unavailable" >&2
  exit 0
fi

# Sync agents: copy each .md file that isn't already defined locally.
if [ -d "$LIB_CACHE/.claude/agents" ]; then
  mkdir -p "$DEST_AGENTS"
  for f in "$LIB_CACHE/.claude/agents"/*.md; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    if [ ! -e "$DEST_AGENTS/$name" ]; then
      cp "$f" "$DEST_AGENTS/$name"
    fi
  done
fi

# Sync skills: copy each skill directory that isn't already defined locally.
# Skip retired/meta entries that aren't real skills.
if [ -d "$LIB_CACHE/.claude/skills" ]; then
  mkdir -p "$DEST_SKILLS"
  for d in "$LIB_CACHE/.claude/skills"/*/; do
    [ -e "$d" ] || continue
    name="$(basename "$d")"
    case "$name" in
      _retired) continue ;;
    esac
    if [ ! -e "$DEST_SKILLS/$name" ]; then
      cp -r "$d" "$DEST_SKILLS/$name"
    fi
  done
fi

echo "agent-skills-library synced into .claude/agents and .claude/skills" >&2
