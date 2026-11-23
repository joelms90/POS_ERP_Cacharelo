#!/usr/bin/env node
/**
 * Business-flow explorer.
 *
 * The prose lives in knowledge/workflows/*.md. This script only reads their
 * frontmatter (actors, seeds, tables, rules, screens, endpoints) and joins it
 * to the live code graph, so the code chain is derived — never hand-maintained.
 *
 *   node scripts/flows.mjs list
 *   node scripts/flows.mjs show "order to cash"
 *   node scripts/flows.mjs show order-to-cash --json
 *   node scripts/flows.mjs check
 *
 * `check` is meant for CI / `make check-all`: it fails when a flow anchor
 * (seed symbol, table, rule, screen, endpoint, SOP) no longer exists, or when
 * the committed graph is older than HEAD.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = join(ROOT, 'knowledge', 'workflows');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'do', 'how', 'flow', 'workflow']);
const tokens = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end === -1) return {};
  const lines = text.slice(4, end).split('\n');
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val === '') {
      const arr = [];
      while (i + 1 < lines.length) {
        const item = lines[i + 1].match(/^\s+-\s+(.*)$/);
        if (!item) break;
        arr.push(stripQuotes(item[1].trim()));
        i++;
      }
      out[key] = arr;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      out[key] = val.slice(1, -1).split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
    } else {
      out[key] = stripQuotes(val);
    }
  }
  return out;
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, '');
}

function firstHeading(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[`*_]/g, '').trim() : '';
}

function loadFlows() {
  const flows = [];
  for (const f of readdirSync(WORKFLOWS_DIR)) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    const path = join(WORKFLOWS_DIR, f);
    const text = readFileSync(path, 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm.flow) continue;
    flows.push({
      id: fm.flow,
      title: fm.title || firstHeading(text) || basename(f, '.md'),
      sop: relative(ROOT, path),
      actors: fm.actors || [],
      endpoints: fm.endpoints || [],
      seeds: fm.seeds || [],
      tables: fm.tables || [],
      rules: fm.rules || [],
      screens: fm.screens || [],
      tags: fm.tags || [],
    });
  }
  return flows.sort((a, b) => a.id.localeCompare(b.id));
}

function matchFlow(flows, query) {
  const q = query.trim().toLowerCase();
  const exact = flows.find((f) => f.id.toLowerCase() === q);
  if (exact) return exact;
  const qt = new Set(tokens(query));
  let best = null;
  let bestScore = 0;
  for (const f of flows) {
    const hay = [f.id, f.title, ...f.actors, ...f.tags].join(' ').toLowerCase();
    let score = 0;
    for (const t of qt) if (hay.includes(t)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function graphLabels() {
  if (!existsSync(GRAPH)) return null;
  try {
    const g = JSON.parse(readFileSync(GRAPH, 'utf8'));
    return { labels: new Set((g.nodes || []).map((n) => n.label).filter(Boolean)), builtAt: g.built_at_commit || '' };
  } catch {
    return null;
  }
}

function loadTables() {
  const file = join(ROOT, 'apps/sync_api/src/database/schema.ts');
  if (!existsSync(file)) return new Set();
  const text = readFileSync(file, 'utf8');
  return new Set([...text.matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
}

function loadRules() {
  const dir = join(ROOT, 'knowledge', 'business-rules');
  const set = new Set();
  if (!existsSync(dir)) return set;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/BR-[A-Z]+-\d+/g)) set.add(m[0]);
  }
  return set;
}

function loadEndpoints() {
  const set = new Set();
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!['node_modules', 'dist'].includes(e.name)) walk(p); continue; }
      if (!e.name.endsWith('.controller.ts')) continue;
      for (const m of readFileSync(p, 'utf8').matchAll(/@Controller\(\s*['"]([^'"]*)['"]/g)) set.add(m[1]);
    }
  };
  walk(join(ROOT, 'apps/sync_api/src/modules'));
  return set;
}

function staleSources() {
  const newer = [];
  if (existsSync(join(ROOT, 'graphify-out', 'needs_update'))) newer.push('graphify-out/needs_update');
  if (!existsSync(GRAPH)) return newer;
  let gm;
  try { gm = statSync(GRAPH).mtimeMs; } catch { return newer; }
  let files = [];
  try { files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return newer; }
  const codeExt = /\.(ts|tsx|js|jsx|mjs|cjs|dart|sql|sh|bash|tf|hcl|py|json|yaml|yml)$/;
  for (const f of files) {
    if (!codeExt.test(f) || f.startsWith('graphify-out/')) continue;
    try {
      if (statSync(join(ROOT, f)).mtimeMs > gm) {
        newer.push(f);
        if (newer.length >= 3) break;
      }
    } catch { /* ignore */ }
  }
  return newer;
}

function chainFor(seeds) {
  if (!existsSync(GRAPH) || seeds.length < 2) return [];
  const out = [];
  for (let i = 0; i < seeds.length - 1; i++) {
    const a = seeds[i];
    const b = seeds[i + 1];
    try {
      const raw = execFileSync('graphify', ['path', a, b, '--undirected', '--graph', 'graphify-out/graph.json'], {
        cwd: ROOT, encoding: 'utf8', timeout: 30000,
      });
      const lines = raw.trim().split('\n').filter(Boolean);
      const header = lines[0] || '';
      const route = lines.find((l) => l.trim().startsWith(a) || l.trim().startsWith('`')) || lines[1] || '';
      out.push({ from: a, to: b, ok: true, header, route: route.trim() });
    } catch (err) {
      const msg = (err.stdout || err.stderr || '').toString().trim().split('\n')[0] || 'no path';
      out.push({ from: a, to: b, ok: false, header: msg, route: '' });
    }
  }
  return out;
}

function cmdList(flows, json) {
  if (json) {
    console.log(JSON.stringify(flows.map((f) => ({ id: f.id, title: f.title, sop: f.sop, actors: f.actors, rules: f.rules.length, seeds: f.seeds.length })), null, 2));
    return;
  }
  console.log(`Business flows (${flows.length})\n`);
  for (const f of flows) {
    console.log(`  ${f.id.padEnd(26)} ${f.title}`);
    console.log(`  ${''.padEnd(26)} ${f.sop}  ·  ${f.seeds.length} seeds · ${f.rules.length} rules`);
  }
}

function cmdShow(flows, query, json, withChain) {
  const f = matchFlow(flows, query);
  if (!f) {
    console.error(`No flow matching "${query}". Run: node scripts/flows.mjs list`);
    process.exit(4);
  }
  const chain = withChain ? chainFor(f.seeds) : [];
  if (json) {
    console.log(JSON.stringify({ ...f, chain }, null, 2));
    return;
  }
  console.log(`FLOW      ${f.id} — ${f.title}`);
  console.log(`SOP       ${f.sop}`);
  console.log(`ACTORS    ${f.actors.join(' · ') || '(none)'}`);
  console.log(`ENDPOINTS ${f.endpoints.join(' · ') || '(none)'}`);
  console.log(`RULES     ${f.rules.join(' · ') || '(none)'}`);
  console.log(`TABLES    ${f.tables.join(' · ') || '(none)'}`);
  console.log(`SEEDS     ${f.seeds.join(' → ') || '(none)'}`);
  if (f.screens.length) {
    console.log('SCREENS');
    for (const s of f.screens) console.log(`  - ${s}`);
  }
  if (chain.length) {
    console.log('CODE CHAIN (structural paths from graph.json; may include imports)');
    for (const c of chain) {
      if (c.ok) {
        console.log(`  ${c.from} → ${c.to}: ${String(c.header || 'path found').replace(/:\s*$/, '')}`);
        if (c.route && c.route !== c.header) console.log(`    ${c.route}`);
      } else {
        console.log(`  ${c.from} → ${c.to}: ${c.header}`);
      }
    }
  }
  console.log('NEXT');
  console.log(`  - read ${f.sop}`);
  if (f.seeds.length >= 2) console.log(`  - graphify path "${f.seeds[0]}" "${f.seeds[f.seeds.length - 1]}" --undirected`);
  console.log(`  - make logs-search Q="${f.actors[0] || f.id}"`);
}

function cmdCheck(flows, json) {
  const labels = graphLabels();
  const tables = loadTables();
  const rules = loadRules();
  const endpoints = loadEndpoints();
  const warnings = [];
  const results = [];

  if (!labels) warnings.push('graphify-out/graph.json missing — run `make graphify-build` (seed symbols not validated)');
  const stale = staleSources();
  if (stale.length) warnings.push(`graph is older than source files (${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ', …' : ''}) — run \`make graphify-update\``);

  for (const f of flows) {
    const missing = [];
    if (labels) for (const s of f.seeds) if (!labels.labels.has(s)) missing.push(`seed:${s}`);
    for (const t of f.tables) if (!tables.has(t)) missing.push(`table:${t}`);
    for (const r of f.rules) if (!rules.has(r)) missing.push(`rule:${r}`);
    for (const e of f.endpoints) if (!endpoints.has(e)) missing.push(`endpoint:${e}`);
    for (const s of f.screens) if (!existsSync(join(ROOT, s))) missing.push(`screen:${s}`);
    if (!existsSync(join(ROOT, f.sop))) missing.push(`sop:${f.sop}`);
    results.push({ id: f.id, title: f.title, ok: missing.length === 0, missing });
  }

  const failed = results.filter((r) => !r.ok);
  if (json) {
    console.log(JSON.stringify({ ok: failed.length === 0, warnings, results }, null, 2));
  } else {
    for (const w of warnings) console.log(`WARN  ${w}`);
    for (const r of results) {
      if (r.ok) console.log(`PASS  ${r.id}`);
      else {
        console.log(`FAIL  ${r.id}`);
        for (const m of r.missing) console.log(`        missing ${m}`);
      }
    }
    console.log(`\n${results.length - failed.length}/${results.length} flows valid.`);
  }
  if (failed.length) process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const noChain = argv.includes('--no-chain');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const cmd = positional[0] || 'list';
  const flows = loadFlows();

  if (cmd === 'list') return cmdList(flows, json);
  if (cmd === 'show') {
    if (!positional[1]) {
      console.error('Usage: node scripts/flows.mjs show "<flow or query>" [--json] [--no-chain]');
      process.exit(2);
    }
    return cmdShow(flows, positional.slice(1).join(' '), json, !noChain);
  }
  if (cmd === 'check') return cmdCheck(flows, json);

  console.error('Commands: list | show "<flow>" | check');
  process.exit(2);
}

main();
