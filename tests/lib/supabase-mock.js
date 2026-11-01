'use strict';
// A stateful stand-in for the parts of Supabase the app talks to: GoTrue
// (/auth/v1/*) and PostgREST (/rest/v1/*). Installed with page.route on the
// project URL, so the real index.html and the real vendored supabase-js run
// against it unmodified.
//
// "Stateful" is the point. A mock that answers 200 to everything lets a test
// pass because the mock accepted it, so this one keeps real tables keyed by
// (user_id, id) and ENFORCES the rules the real backend enforces that the app
// has to work around:
//
//   * insert-if-absent honours `Prefer: resolution=ignore-duplicates`;
//     a merge upsert (the supabase-js default) is refused with 42501, because
//     the grant matrix gives these tables no UPDATE (Slice 1, 20_privileges)
//   * a bulk insert nulls keys a row leaves out, unless `Prefer: missing=default`
//     — so a NOT NULL default '' column breaks (23502) if a row omits it
//   * DELETE with no filter is refused (pg-safeupdate), as is UPDATE
//   * update touches only the granted columns; session_checkins has no update
//     or delete, races no update, plan_sessions no plan_date/id/user_id
//   * `Range` paging with a server max-rows cap, and `Content-Range` totals
//   * rows are visible only to their own user_id, and only if that user is in
//     allowed_users (the SQL harness proves the real RLS; this is the minimum
//     needed for the app's mode logic to be tested against something honest)
//   * an expired or missing JWT answers 401
//
// What it does not do: real SQL, real RLS, real GoTrue. See CLAUDE.md.

const PROJECT = 'ghfvmsyxfovwaeeuzlzn';
const ORIGIN = 'https://' + PROJECT + '.supabase.co';
const STORAGE_KEY = 'sb-' + PROJECT + '-auth-token';
const OWNER_ID = '00000000-0000-4000-8000-0000000000a1';
const OWNER_EMAIL = 'sam@example.test';

const b64url = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function makeJwt(sub, email, expSec) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: expSec || now + 3600 }),
    'signature-not-checked',
  ].join('.');
}
function sessionFor(userId, email, expiresInSec) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInSec || 3600);
  return {
    access_token: makeJwt(userId, email, exp),
    refresh_token: 'refresh-' + userId,
    token_type: 'bearer',
    expires_in: expiresInSec || 3600,
    expires_at: exp,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
}

// Column rules, taken from supabase/migrations (kept in step by hand).
const TABLES = {
  allowed_users: { pk: ['user_id'], cols: ['user_id', 'note', 'created_at'], notNull: [], grants: { insert: false, update: [], delete: false } },
  session_checkins: {
    pk: ['user_id', 'id'],
    cols: ['id', 'session_date', 'disc', 'duration', 'intensity', 'rpe', 'a1', 'a2', 'a3', 'b2', 'b3', 'note', 'phase', 'logged_at'],
    notNull: ['id', 'session_date', 'disc', 'intensity', 'note'],
    defaults: { disc: '', intensity: '', note: '' },
    grants: { insert: true, update: [], delete: false },
  },
  races: {
    pk: ['user_id', 'id'],
    cols: ['id', 'name', 'race_date', 'url', 'notes', 'status'],
    notNull: ['id', 'name', 'race_date', 'url', 'notes', 'status'],
    defaults: { url: '', notes: '', status: 'considering' },
    grants: { insert: true, update: [], delete: true },
  },
  plan_sessions: {
    pk: ['user_id', 'id'],
    cols: ['id', 'plan_date', 'disc', 'title', 'intensity', 'duration', 'is_key', 'notes', 'phase'],
    notNull: ['id', 'plan_date', 'disc', 'title', 'intensity', 'is_key', 'notes', 'phase'],
    defaults: { disc: '', title: '', intensity: '', is_key: false, notes: '', phase: '' },
    grants: { insert: true, update: ['disc', 'title', 'intensity', 'duration', 'is_key', 'notes', 'phase'], delete: true },
  },
  phase_blocks: {
    pk: ['user_id', 'id'],
    cols: ['id', 'from_date', 'phase'],
    notNull: ['id', 'from_date', 'phase'],
    defaults: {},
    grants: { insert: true, update: ['from_date', 'phase'], delete: true },
  },
  sheet_import: { pk: ['user_id'], cols: ['counts'], notNull: ['counts'], defaults: {}, grants: { insert: true, update: [], delete: false } },
};

function pgError(status, code, message) {
  return { status, body: { code, message, details: null, hint: null } };
}

class Backend {
  // opts: userId, email, allowed (default true), imported (default false), maxRows
  constructor(opts) {
    opts = opts || {};
    this.userId = opts.userId || OWNER_ID;
    this.email = opts.email || OWNER_EMAIL;
    this.maxRows = opts.maxRows || 1000;
    this.tables = {};
    for (const t of Object.keys(TABLES)) this.tables[t] = [];
    this.seq = 0;
    this.allowedUsers = new Set();
    if (opts.allowed !== false) this.allow(this.userId);
    if (opts.imported) this.tables.sheet_import.push({ user_id: this.userId, counts: {} });
    this.requests = [];     // every request that reached the mock
    this.rules = [];        // injected failures / delays
    this.authorizeUrls = [];
    this.exchangeCount = 0;
    this.loggedOut = 0;
    this.tokenExpired = false; // when true every REST call answers 401 JWT expired
  }

  // ---- seeding ---------------------------------------------------------
  allow(userId) {
    userId = userId || this.userId;
    if (!this.allowedUsers.has(userId)) {
      this.allowedUsers.add(userId);
      this._insertRow('allowed_users', { user_id: userId, note: null });
    }
    return this;
  }
  seed(table, rows, userId) {
    for (const r of rows) this._insertRow(table, Object.assign({ user_id: userId || this.userId }, this._withDefaults(table, r)));
    return this;
  }
  _withDefaults(table, r) {
    const out = Object.assign({}, TABLES[table].defaults || {});
    for (const c of TABLES[table].cols) if (!(c in out)) out[c] = null;
    return Object.assign(out, r);
  }
  _insertRow(table, row) {
    row.seq = ++this.seq;
    row.created_at = '2026-11-01T00:00:00Z';
    this.tables[table].push(row);
    return row;
  }
  rows(table, userId) { return this.tables[table].filter((r) => r.user_id === (userId || this.userId)); }

  // ---- failure injection ----------------------------------------------
  // match: (info) => bool, info = {method, table, query, body, path}
  // action: {status, body} to answer instead, {abort:true} to drop the
  // connection, {delayMs} to hold the response, {neverRespond:true}.
  inject(match, action, opts) {
    const rule = Object.assign({ match, action, times: (opts && opts.times) || Infinity, used: 0 }, {});
    this.rules.push(rule);
    return rule;
  }
  clearRules() { this.rules = []; }

  requestsTo(table, method) {
    return this.requests.filter((r) => r.table === table && (!method || r.method === method));
  }
  dataRequests() { return this.requests.filter((r) => r.rest && r.table && r.table !== 'allowed_users' && r.table !== 'sheet_import'); }

  // ---- page seeding ----------------------------------------------------
  sessionJson(expiresInSec) { return JSON.stringify(sessionFor(this.userId, this.email, expiresInSec)); }
  // Run before the app boots (addInitScript) — but only if nothing is stored
  // yet, so a sign-out followed by a reload stays signed out.
  async seedSignedIn(ctx, expiresInSec) {
    const json = this.sessionJson(expiresInSec);
    await ctx.addInitScript(([k, v]) => {
      if (!window.localStorage.getItem(k) && !window.sessionStorage.getItem('__seeded')) {
        window.localStorage.setItem(k, v);
        window.sessionStorage.setItem('__seeded', '1');
      }
    }, [STORAGE_KEY, json]);
  }

  // ---- routing ---------------------------------------------------------
  async install(ctx) {
    await ctx.route(ORIGIN + '/**', (route) => this._handle(route));
  }

  async _handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': req.headers()['origin'] || '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': 'Content-Range,Content-Profile',
      'access-control-allow-credentials': 'true',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    const path = url.pathname;
    let body = null;
    const raw = req.postData();
    if (raw) { try { body = JSON.parse(raw); } catch (e) { body = raw; } }
    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(path);
    const info = { start: Date.now(), end: null, method: req.method(), path, query: url.searchParams, search: url.search, body, table: m ? m[1] : null, rest: !!m, headers: req.headers(), resourceType: req.resourceType() };
    this.requests.push(info);

    for (const rule of this.rules) {
      if (rule.used >= rule.times || !rule.match(info)) continue;
      rule.used++;
      const a = rule.action;
      info.ruled = true;
      if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
      if (a.neverRespond) return new Promise(() => {});
      if (a.abort) return route.abort('failed');
      if (a.status) {
        return route.fulfill({ status: a.status, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify(a.body === undefined ? { message: 'injected failure' } : a.body) });
      }
    }

    let out;
    if (path.startsWith('/auth/v1/')) out = this._auth(req, url, path, body);
    else if (m) out = this._rest(info, m[1]);
    else out = pgError(404, 'NOTFOUND', 'no such route in the mock: ' + path);
    const headers = Object.assign({ 'content-type': 'application/json' }, cors, out.headers || {});
    info.status = out.status;
    const done = await route.fulfill({ status: out.status, headers, body: out.status === 204 ? '' : JSON.stringify(out.body === undefined ? null : out.body) });
    info.end = Date.now();
    return done;
  }

  // ---- GoTrue ------------------------------------------------------------
  _auth(req, url, path, body) {
    if (path === '/auth/v1/authorize') { this.authorizeUrls.push(url.toString()); return { status: 200, body: {} }; }
    if (path === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'pkce') {
        this.exchangeCount++;
        if (!body || !body.auth_code || !body.code_verifier) return { status: 400, body: { error: 'invalid_request', error_description: 'missing code or verifier' } };
        return { status: 200, body: sessionFor(this.userId, this.email) };
      }
      if (grant === 'refresh_token') return { status: 200, body: sessionFor(this.userId, this.email) };
    }
    if (path === '/auth/v1/user') return { status: 200, body: sessionFor(this.userId, this.email).user };
    if (path === '/auth/v1/logout') { this.loggedOut++; return { status: 204 }; }
    return { status: 404, body: { message: 'auth route not mocked: ' + path } };
  }

  // ---- PostgREST ---------------------------------------------------------
  _jwtUser(info) {
    const auth = info.headers['authorization'] || '';
    const tok = auth.replace(/^Bearer\s+/i, '');
    const parts = tok.split('.');
    if (parts.length !== 3) return null;
    try {
      const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (!p.sub || p.role !== 'authenticated') return null;
      if (p.exp && p.exp < Math.floor(Date.now() / 1000)) return 'expired';
      return p.sub;
    } catch (e) { return null; }
  }
  _filters(info) {
    const f = [];
    for (const [k, v] of info.query.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const mm = /^(not\.)?(eq|neq|gte|lte|gt|lt|is)\.(.*)$/.exec(v);
      if (!mm) continue;
      f.push({ col: k, neg: !!mm[1], op: mm[2], val: mm[3] });
    }
    return f;
  }
  _matches(row, f) {
    const v = row[f.col];
    let r;
    switch (f.op) {
      case 'eq': r = String(v) === f.val; break;
      case 'neq': r = String(v) !== f.val; break;
      case 'gte': r = v !== null && String(v) >= f.val; break;
      case 'lte': r = v !== null && String(v) <= f.val; break;
      case 'gt': r = v !== null && String(v) > f.val; break;
      case 'lt': r = v !== null && String(v) < f.val; break;
      case 'is': r = f.val === 'null' ? v === null || v === undefined : String(v) === f.val; break;
      default: r = true;
    }
    return f.neg ? !r : r;
  }
  _project(row, select) {
    if (!select || select === '*') return Object.assign({}, row);
    const o = {};
    for (const c of select.split(',')) o[c] = row[c];
    return o;
  }
  _rest(info, table) {
    const spec = TABLES[table];
    if (!spec) return pgError(404, '42P01', 'relation "public.' + table + '" does not exist');
    const sub = this._jwtUser(info);
    if (sub === 'expired' || this.tokenExpired) return { status: 401, body: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } };
    if (!sub) return pgError(401, 'PGRST301', 'no valid JWT');
    const allowed = this.allowedUsers.has(sub);
    const own = (r) => r.user_id === sub && (table === 'allowed_users' || allowed);
    const prefer = (info.headers['prefer'] || '').split(',').map((s) => s.trim());
    const hasPref = (x) => prefer.includes(x);
    const select = info.query.get('select');

    if (info.method === 'GET') {
      const filters = this._filters(info);
      let rows = this.tables[table].filter(own).filter((r) => filters.every((f) => this._matches(r, f)));
      rows.sort((a, b) => a.seq - b.seq);
      const total = rows.length;
      let start = 0, end = total - 1;
      // supabase-js's .range(a, b) is sent as ?offset=a&limit=b-a+1; a raw
      // `Range: a-b` header is honoured too.
      const range = info.headers['range'];
      if (range && /^\d+-\d*$/.test(range)) {
        const [a, b] = range.split('-');
        start = parseInt(a, 10);
        end = b === '' ? total - 1 : parseInt(b, 10);
      }
      const offset = info.query.get('offset');
      if (offset) start = parseInt(offset, 10);
      const limit = info.query.get('limit');
      if (limit) end = start + parseInt(limit, 10) - 1;
      end = Math.min(end, start + this.maxRows - 1, total - 1);
      if (start >= total && total > 0 && (range || offset)) return { status: 416, body: { code: 'PGRST103', message: 'Requested range not satisfiable' } };
      const page = rows.slice(start, end + 1).map((r) => this._project(r, select));
      const partial = page.length < total;
      const cr = page.length ? start + '-' + (start + page.length - 1) + '/' + total : '*/' + total;
      return { status: partial ? 206 : 200, headers: { 'content-range': cr }, body: page };
    }

    if (info.method === 'POST') {
      if (!spec.grants.insert) return pgError(403, '42501', 'permission denied for table ' + table);
      if (hasPref('resolution=merge-duplicates')) return pgError(403, '42501', 'permission denied for table ' + table + ' (a merge upsert needs UPDATE, which is not granted)');
      const ignore = hasPref('resolution=ignore-duplicates');
      const onConflict = (info.query.get('on_conflict') || '').split(',').filter(Boolean);
      if (ignore && onConflict.join(',') !== spec.pk.join(',')) return pgError(400, '42P10', 'there is no unique or exclusion constraint matching the ON CONFLICT specification');
      const rows = Array.isArray(info.body) ? info.body : [info.body];
      // Keys of the whole batch: a key one row has and another lacks is NULL
      // for the other, unless Prefer: missing=default.
      const keys = new Set();
      rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));
      const missingDefault = hasPref('missing=default');
      const inserted = [];
      const staged = [];
      for (const r of rows) {
        if (!allowed) return pgError(403, '42501', 'new row violates row-level security policy for table "' + table + '"');
        if ('user_id' in r && r.user_id !== sub) return pgError(403, '42501', 'new row violates row-level security policy for table "' + table + '"');
        for (const k of keys) {
          if (k !== 'user_id' && !spec.cols.includes(k)) return pgError(400, 'PGRST204', "Could not find the '" + k + "' column of '" + table + "' in the schema cache");
        }
        const row = { user_id: sub };
        for (const c of spec.cols) {
          if (c in r) row[c] = r[c];
          else if (keys.has(c)) row[c] = missingDefault && spec.defaults && c in spec.defaults ? spec.defaults[c] : null;
          else row[c] = spec.defaults && c in spec.defaults ? spec.defaults[c] : null;
        }
        for (const c of spec.notNull) {
          if (row[c] === null || row[c] === undefined) return pgError(400, '23502', 'null value in column "' + c + '" of relation "' + table + '" violates not-null constraint');
        }
        if (table === 'races' && !['considering', 'locked'].includes(row.status)) return pgError(400, '23514', 'new row for relation "races" violates check constraint "races_status_check"');
        const dup = this.tables[table].some((x) => spec.pk.every((c) => x[c] === row[c])) || staged.some((x) => spec.pk.every((c) => x[c] === row[c]));
        if (dup) {
          if (ignore) continue;
          return pgError(409, '23505', 'duplicate key value violates unique constraint "' + table + '_pkey"');
        }
        staged.push(row);
      }
      for (const row of staged) inserted.push(this._insertRow(table, row));
      if (hasPref('return=representation')) return { status: 201, body: inserted.map((r) => this._project(r, select)) };
      return { status: 201, body: null };
    }

    if (info.method === 'PATCH') {
      const cols = spec.grants.update;
      if (!cols.length) return pgError(403, '42501', 'permission denied for table ' + table);
      const filters = this._filters(info);
      if (!filters.length) return pgError(400, '21000', 'UPDATE requires a WHERE clause');
      for (const k of Object.keys(info.body || {})) {
        if (!cols.includes(k)) return pgError(403, '42501', 'permission denied for table ' + table + ' (column ' + k + ')');
      }
      const hit = this.tables[table].filter(own).filter((r) => filters.every((f) => this._matches(r, f)));
      hit.forEach((r) => Object.assign(r, info.body));
      return hasPref('return=representation') ? { status: 200, body: hit.map((r) => this._project(r, select)) } : { status: 204 };
    }

    if (info.method === 'DELETE') {
      if (!spec.grants.delete) return pgError(403, '42501', 'permission denied for table ' + table);
      const filters = this._filters(info);
      if (!filters.length) return pgError(400, '21000', 'DELETE requires a WHERE clause');
      const keep = [];
      for (const r of this.tables[table]) {
        if (own(r) && filters.every((f) => this._matches(r, f))) continue;
        keep.push(r);
      }
      this.tables[table] = keep;
      return { status: 204 };
    }
    return pgError(405, 'PGRST000', 'method not allowed');
  }
}

module.exports = { Backend, ORIGIN, PROJECT, STORAGE_KEY, OWNER_ID, OWNER_EMAIL, makeJwt, sessionFor, TABLES };
