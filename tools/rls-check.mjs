#!/usr/bin/env node
/* RecallHSC · Row Level Security check for the cloud-sync tables.

   Usage (Node 18+, no dependencies):
     SUPABASE_URL=https://<project-ref>.supabase.co \
     SUPABASE_ANON_KEY=<publishable / anon key> \
     RLS_A_EMAIL=a@example.test RLS_A_PASSWORD=... \
     RLS_B_EMAIL=b@example.test RLS_B_PASSWORD=... \
     node tools/rls-check.mjs

   Needs two dedicated, pre-created TEST users with email + password sign-in. Never use real accounts:
   user A's test rows are created and removed again (A's prefs row is restored afterwards).

   What it verifies
     * A (signed in) can insert and read back its own essay / progress / stats / prefs rows.
     * B (signed in) cannot read, update, delete or overwrite A's rows, nor insert rows owned by A.
     * A cannot hand a row over to B by changing user_id.
     * Anonymous requests (publishable key only, no user JWT) can read and write nothing and cannot call
       delete_my_account().
   Exit codes: 0 = all checks passed (or skipped because env vars are missing), 1 = a violation or an
   unexpected error. */

const ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RLS_A_EMAIL', 'RLS_A_PASSWORD', 'RLS_B_EMAIL', 'RLS_B_PASSWORD'];
const missing = ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(`rls-check: skipped (missing environment variables: ${missing.join(', ')}).`);
  console.log('Set all of ' + ENV.join(', ') + ' to run the Row Level Security check against a Supabase project.');
  process.exit(0);
}
if (typeof fetch !== 'function') {
  console.error('rls-check: global fetch is unavailable; use Node 18 or newer.');
  process.exit(1);
}

const BASE = process.env.SUPABASE_URL.replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY;
const RUN = Math.random().toString(16).slice(2, 10);
const ESSAY = `rlscheck-${RUN}`;
const REV = 'r00000000' + RUN.padEnd(8, '0').slice(0, 8);
const DEVICE = `rls-check-${RUN}`;

const results = [];
const pass = (name) => { results.push({ ok: true, name }); console.log(`  PASS  ${name}`); };
const fail = (name, detail) => { results.push({ ok: false, name, detail }); console.log(`  FAIL  ${name}\n        ${detail}`); };
const check = (cond, name, detail) => (cond ? pass(name) : fail(name, detail));

/* ---------- HTTP helpers ---------- */
async function signIn(email, password) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token || !body.user?.id) {
    throw new Error(`sign-in failed for ${email}: HTTP ${res.status} ${body.error_description || body.msg || body.error || ''}`.trim());
  }
  return { token: body.access_token, id: body.user.id, email };
}

/** REST call. `who` is a signed-in user or null for anonymous (publishable key only). */
async function rest(who, method, path, { body, prefer } = {}) {
  const headers = { apikey: KEY, Accept: 'application/json' };
  if (who) headers.Authorization = `Bearer ${who.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${BASE}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}
const rows = (r) => (r.ok && Array.isArray(r.data) ? r.data : null);
const describe = (r) => `HTTP ${r.status} ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`.slice(0, 300);
/** True when the request returned nothing: an error status, or a 2xx with an empty array. */
const gotNothing = (r) => !r.ok || (Array.isArray(r.data) && r.data.length === 0);

const TABLES = {
  essays: `essays?essay_id=eq.${ESSAY}`,
  progress: `progress?essay_id=eq.${ESSAY}`,
  stats: `stats?essay_id=eq.${ESSAY}`,
};

/* ---------- main ---------- */
let A = null;
let prefsBefore; // undefined = not read yet, null = A had no prefs row
let failedSetup = false;

async function main() {
  console.log(`rls-check: ${BASE}  (test essay id ${ESSAY})`);
  A = await signIn(process.env.RLS_A_EMAIL, process.env.RLS_A_PASSWORD);
  const B = await signIn(process.env.RLS_B_EMAIL, process.env.RLS_B_PASSWORD);
  if (A.id === B.id) throw new Error('RLS_A_* and RLS_B_* must be two different users');
  console.log(`Signed in A=${A.id} B=${B.id}\n`);

  // Remember A's prefs so the check can restore them.
  const pb = await rest(A, 'GET', `prefs?user_id=eq.${A.id}&select=data`);
  if (!pb.ok) throw new Error(`could not read A's prefs: ${describe(pb)}`);
  prefsBefore = pb.data.length ? pb.data[0].data : null;

  console.log('A writes its own rows');
  const up = 'resolution=merge-duplicates,return=representation';
  const wEssay = await rest(A, 'POST', 'essays?on_conflict=user_id,essay_id', { prefer: up,
    body: { essay_id: ESSAY, title: 'RLS check', body: 'Row level security check.', kind: 'essay', rev: REV, ver: 1, device_id: DEVICE } });
  check(rows(wEssay)?.length === 1 && rows(wEssay)[0].user_id === A.id, 'A upserts an essay (user_id defaults to A)', describe(wEssay));
  const wProg = await rest(A, 'POST', 'progress?on_conflict=user_id,essay_id,rev', { prefer: up,
    body: { essay_id: ESSAY, rev: REV, epoch: 0, learned: '101', g: 1, ti: 0, start_g: 0, device_id: DEVICE } });
  check(rows(wProg)?.length === 1, 'A upserts progress', describe(wProg));
  const wStats = await rest(A, 'POST', 'stats?on_conflict=user_id,essay_id,device_id', { prefer: up,
    body: { essay_id: ESSAY, device_id: DEVICE, data: { att: 1, pass: 1 } } });
  check(rows(wStats)?.length === 1, 'A upserts stats', describe(wStats));
  const wPrefs = await rest(A, 'POST', 'prefs?on_conflict=user_id', { prefer: up, body: { data: { rlsCheck: RUN } } });
  check(rows(wPrefs)?.length === 1, 'A upserts prefs', describe(wPrefs));
  if (results.some((r) => !r.ok)) { failedSetup = true; return; }

  console.log('\nA reads its own rows');
  for (const [t, path] of Object.entries(TABLES)) {
    const r = await rest(A, 'GET', path);
    check(rows(r)?.length === 1, `A can read its ${t} row`, describe(r));
  }
  const ap = await rest(A, 'GET', `prefs?user_id=eq.${A.id}`);
  check(rows(ap)?.length === 1 && ap.data[0].data?.rlsCheck === RUN, 'A can read its prefs row', describe(ap));

  console.log('\nB tries to read A\'s rows');
  for (const [t, path] of Object.entries(TABLES)) {
    const r = await rest(B, 'GET', path);
    check(gotNothing(r), `B cannot select A's ${t}`, describe(r));
    const r2 = await rest(B, 'GET', `${t}?user_id=eq.${A.id}`);
    check(gotNothing(r2), `B cannot select any ${t} row by A's user_id`, describe(r2));
  }
  const bp = await rest(B, 'GET', `prefs?user_id=eq.${A.id}`);
  check(gotNothing(bp), 'B cannot select A\'s prefs', describe(bp));

  console.log('\nB tries to modify A\'s rows');
  const ret = 'return=representation';
  const bu = await rest(B, 'PATCH', TABLES.essays, { prefer: ret, body: { title: 'hijacked', body: 'hijacked' } });
  check(gotNothing(bu), 'B update of A\'s essay affects 0 rows', describe(bu));
  const bpu = await rest(B, 'PATCH', TABLES.progress, { prefer: ret, body: { learned: '111' } });
  check(gotNothing(bpu), 'B update of A\'s progress affects 0 rows', describe(bpu));
  const bsu = await rest(B, 'PATCH', TABLES.stats, { prefer: ret, body: { data: { att: 999 } } });
  check(gotNothing(bsu), 'B update of A\'s stats affects 0 rows', describe(bsu));
  const bpp = await rest(B, 'PATCH', `prefs?user_id=eq.${A.id}`, { prefer: ret, body: { data: { hijacked: true } } });
  check(gotNothing(bpp), 'B update of A\'s prefs affects 0 rows', describe(bpp));
  for (const [t, path] of Object.entries(TABLES)) {
    const r = await rest(B, 'DELETE', path, { prefer: ret });
    check(gotNothing(r), `B delete of A's ${t} affects 0 rows`, describe(r));
  }
  const bpd = await rest(B, 'DELETE', `prefs?user_id=eq.${A.id}`, { prefer: ret });
  check(gotNothing(bpd), 'B delete of A\'s prefs affects 0 rows', describe(bpd));
  const bi = await rest(B, 'POST', 'essays', { prefer: ret,
    body: { user_id: A.id, essay_id: `${ESSAY}-b`, title: 'spoof', body: 'spoof', kind: 'essay', rev: REV, ver: 1 } });
  check(!bi.ok, 'B cannot insert an essay owned by A', describe(bi));
  const bo = await rest(B, 'POST', 'essays?on_conflict=user_id,essay_id', { prefer: up,
    body: { user_id: A.id, essay_id: ESSAY, title: 'overwrite', body: 'overwrite', kind: 'essay', rev: REV, ver: 9 } });
  check(!bo.ok, 'B cannot upsert over A\'s essay', describe(bo));

  console.log('\nA\'s rows are intact');
  const ae = await rest(A, 'GET', TABLES.essays);
  check(rows(ae)?.length === 1 && ae.data[0].title === 'RLS check' && ae.data[0].ver === 1, 'A\'s essay unchanged', describe(ae));
  const apr = await rest(A, 'GET', TABLES.progress);
  check(rows(apr)?.length === 1 && apr.data[0].learned === '101', 'A\'s progress unchanged', describe(apr));
  const ast = await rest(A, 'GET', TABLES.stats);
  check(rows(ast)?.length === 1 && ast.data[0].data?.att === 1, 'A\'s stats unchanged', describe(ast));
  const apf = await rest(A, 'GET', `prefs?user_id=eq.${A.id}`);
  check(rows(apf)?.length === 1 && apf.data[0].data?.rlsCheck === RUN, 'A\'s prefs unchanged', describe(apf));

  console.log('\nOwnership cannot be transferred');
  const xfer = await rest(A, 'PATCH', TABLES.essays, { prefer: ret, body: { user_id: B.id } });
  check(!xfer.ok, 'A cannot change user_id of its essay to B', describe(xfer));
  const bAfter = await rest(B, 'GET', TABLES.essays);
  check(gotNothing(bAfter), 'B still sees no essay after the transfer attempt', describe(bAfter));

  console.log('\nAnonymous access (publishable key, no user JWT)');
  for (const t of ['essays', 'progress', 'stats', 'prefs']) {
    const r = await rest(null, 'GET', `${t}?select=*&limit=5`);
    check(gotNothing(r), `anon cannot select from ${t}`, describe(r));
  }
  const ai = await rest(null, 'POST', 'essays', { prefer: ret,
    body: { user_id: A.id, essay_id: `${ESSAY}-anon`, title: 'anon', body: 'anon', kind: 'essay', rev: REV, ver: 1 } });
  check(!ai.ok, 'anon cannot insert an essay', describe(ai));
  const au = await rest(null, 'PATCH', TABLES.essays, { prefer: ret, body: { title: 'anon' } });
  check(gotNothing(au), 'anon cannot update essays', describe(au));
  const ad = await rest(null, 'DELETE', TABLES.essays, { prefer: ret });
  check(gotNothing(ad), 'anon cannot delete essays', describe(ad));
  const arpc = await rest(null, 'POST', 'rpc/delete_my_account', { body: {} });
  check(!arpc.ok, 'anon cannot call delete_my_account()', describe(arpc));
}

async function cleanup() {
  if (!A) return;
  console.log('\nCleaning up A\'s test rows');
  const errors = [];
  for (const path of [TABLES.progress, TABLES.stats, TABLES.essays]) {
    const r = await rest(A, 'DELETE', path).catch((e) => ({ ok: false, status: 0, data: String(e) }));
    if (!r.ok) errors.push(`DELETE ${path}: ${describe(r)}`);
  }
  if (prefsBefore !== undefined) {
    const r = prefsBefore === null
      ? await rest(A, 'DELETE', `prefs?user_id=eq.${A.id}`)
      : await rest(A, 'PATCH', `prefs?user_id=eq.${A.id}`, { body: { data: prefsBefore } });
    if (!r.ok) errors.push(`restore prefs: ${describe(r)}`);
  }
  const left = await rest(A, 'GET', TABLES.essays);
  if (!gotNothing(left)) errors.push(`test essay still present: ${describe(left)}`);
  if (errors.length) fail('cleanup', errors.join('\n        '));
  else pass('cleanup removed the test rows');
}

let fatal = null;
try {
  await main();
} catch (e) {
  fatal = e;
} finally {
  try { await cleanup(); } catch (e) { fail('cleanup', String(e && e.message || e)); }
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + '-'.repeat(70));
if (fatal) console.log(`ERROR: ${fatal.message || fatal}`);
if (failedSetup) console.log('Setup writes failed, so isolation checks were not run (is the migration applied?).');
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
  console.log('\nViolations / failures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
process.exit(fatal || failed.length ? 1 : 0);
