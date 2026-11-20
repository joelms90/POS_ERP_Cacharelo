#!/usr/bin/env node
/**
 * Production log triage CLI (agent-agnostic: Claude, Codex, agy, opencode or a human).
 *
 *   node scripts/prod-logs.mjs summary [--date 2026-11-20 | --hours 24] [--branch <id>] [--source pos_flutter|admin_web|sync_api] [--min-level warn]
 *   node scripts/prod-logs.mjs search  [--q "texto"] [--fingerprint <fp>] [--branch <id>] [--hours 24] [--limit 50]
 *   node scripts/prod-logs.mjs show <logId>
 *
 * Add --json for raw output. Env:
 *   POS_ADMIN_TOKEN  (required) admin password accepted by the API's AdminGuard (X-Admin-Token)
 *   POS_API_URL      (optional) defaults to production
 */

const API = (process.env.POS_API_URL || 'https://pos-sync-api-232144991863.us-central1.run.app/api').replace(/\/+$/, '');
const TOKEN = process.env.POS_ADMIN_TOKEN;

const [command = 'summary', ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else flags[key] = rest[++i];
  } else positional.push(a);
}

if (!TOKEN) {
  console.error('POS_ADMIN_TOKEN is not set. Export the admin password used by the API (X-Admin-Token).');
  process.exit(2);
}

async function call(path, query = {}) {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== true && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'X-Admin-Token': TOKEN } });
  const text = await res.text();
  if (!res.ok) {
    console.error(`API ${res.status} ${url.pathname}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

const fmtTime = (iso) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: false, dateStyle: 'short', timeStyle: 'medium' });
const indent = (s, n = 4) => String(s).split('\n').map((l) => ' '.repeat(n) + l).join('\n');

const common = () => ({
  date: flags.date,
  hours: flags.hours,
  since: flags.since,
  until: flags.until,
  branchId: flags.branch,
  source: flags.source,
  minLevel: flags['min-level'],
  q: flags.q,
  fingerprint: flags.fingerprint,
  limit: flags.limit,
});

async function summary() {
  const data = await call('/admin/logs/summary', { minLevel: 'warn', ...common() });
  if (flags.json) return console.log(JSON.stringify(data, null, 2));

  const { window, totals, branches, issues } = data;
  const total = totals.reduce((s, t) => s + t.count, 0);
  console.log(`# Production log summary`);
  console.log(`Window: ${window.since ? fmtTime(window.since) : '…'} → ${window.until ? fmtTime(window.until) : 'now'} (America/Mexico_City)`);
  console.log(`API: ${API}\n`);
  if (!total) {
    console.log('No issues recorded in this window. ✅');
    return;
  }
  console.log(`## Totals (${total} entries)`);
  for (const t of totals) console.log(`- ${t.source} / ${t.level}: ${t.count}`);
  console.log(`\n## By branch (sucursal)`);
  for (const b of branches) console.log(`- ${b.branchName} (${b.branchId ?? 'n/a'}): ${b.count} entries, ${b.errors} errors`);
  console.log(`\n## Distinct issues (most frequent first)`);
  issues.forEach((i, n) => {
    console.log(`\n### ${n + 1}. [${i.level}] ${i.source} — ${i.count}x`);
    console.log(`- message: ${i.message}`);
    if (i.route) console.log(`- route: ${i.httpStatus ?? ''} ${i.route}`);
    console.log(`- seen: ${fmtTime(i.firstSeen)} → ${fmtTime(i.lastSeen)}`);
    console.log(`- branches: ${i.branches.join(', ') || 'n/a'} | devices: ${i.devices} | versions: ${i.appVersions.join(', ') || 'n/a'}`);
    if (i.users.length) console.log(`- users: ${i.users.join(', ')}`);
    console.log(`- fingerprint: ${i.fingerprint} | sample: node scripts/prod-logs.mjs show ${i.sampleId}`);
    if (i.sampleStack) console.log(`- stack (top):\n${indent(i.sampleStack.split('\n').slice(0, 8).join('\n'))}`);
  });
}

async function search() {
  const rows = await call('/admin/logs', { hours: flags.date || flags.since ? undefined : '24', ...common() });
  if (flags.json) return console.log(JSON.stringify(rows, null, 2));
  if (!rows.length) return console.log('No matching entries.');
  for (const r of rows) {
    console.log(
      `${fmtTime(r.occurredAt)} [${r.level}] ${r.source} @ ${r.branchName ?? 'n/a'} ${r.userName ? `(${r.userName})` : ''} ${r.appVersion ?? ''}`,
    );
    console.log(`  ${r.message}${r.route ? `  ← ${r.httpMethod ?? ''} ${r.route}` : ''}`);
    console.log(`  id=${r.id} fp=${r.fingerprint}`);
  }
}

async function show() {
  const id = positional[0];
  if (!id) {
    console.error('Usage: prod-logs.mjs show <logId>');
    process.exit(2);
  }
  const row = await call(`/admin/logs/${encodeURIComponent(id)}`);
  console.log(JSON.stringify(row, null, 2));
}

const commands = { summary, search, show };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: summary | search | show`);
  process.exit(2);
}
await commands[command]();
