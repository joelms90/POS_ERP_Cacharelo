#!/usr/bin/env node
/**
 * Deterministic agent router (no LLM, no tokens, <100ms).
 *
 * Maps a task description to the best matching skill, SOP/knowledge doc and
 * Make target so agents do not spend tokens reading AGENT_NAVIGATION_GUIDE.md,
 * knowledge/index.md and `make help` to discover them.
 *
 *   node scripts/agent-router.mjs "deploy the backend"
 *   node scripts/agent-router.mjs "how do I add a db migration" --json
 *   node scripts/agent-router.mjs --list
 *
 * Sources (re-parsed live, so it never goes stale):
 *   - Makefile            targets + help descriptions
 *   - .agents/skills/*    skill name + description (generic/antigravity)
 *   - .claude/skills/*    skill name + description
 *   - docs/, knowledge/   SOPs, runbooks, architecture notes
 *   - root *.md, .claude/*.md
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.worktrees', '.dev-logs', '.dart_tool',
  'build', 'dist', 'coverage', '.terraform', 'graphify-out', 'logs',
]);

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'do', 'does', 'how', 'what', 'where', 'when', 'why', 'i', 'we', 'you',
  'it', 'this', 'that', 'my', 'our', 'can', 'should', 'need', 'want', 'use',
  'using', 'run', 'make', 'please', 'help', 'me', 'about', 'into', 'from',
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'como', 'para', 'por',
  'con', 'sin', 'del', 'al', 'y', 'o', 'en', 'se', 'mi', 'tu', 'su',
]);

function tokens(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function frontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end === -1) return {};
  const out = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) out[m[1]] = v;
  }
  return out;
}

function firstHeading(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[`*_]/g, '').trim() : '';
}

function firstParagraph(text) {
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('---') || t.startsWith('|')) continue;
    return t.replace(/[`*_]/g, '').slice(0, 220);
  }
  return '';
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else if (extname(e.name).toLowerCase() === '.md') {
      out.push(p);
    }
  }
}

function readMakefile() {
  const path = join(ROOT, 'Makefile');
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const help = new Map();
  const echoRe = /@echo\s+"\s{1,}([A-Za-z0-9_.-]+)\s{2,}(.+?)"\s*$/gm;
  for (const m of text.matchAll(echoRe)) help.set(m[1], m[2].trim());
  const targets = [];
  for (const line of text.split('\n')) {
    if (/^\t/.test(line) || /^\s/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*:(?!=)/);
    if (!m) continue;
    const t = m[1];
    if (t.startsWith('.') || t === 'help') continue;
    targets.push(t);
  }
  return [...new Set(targets)].map((target) => ({
    kind: 'make',
    id: target,
    path: 'Makefile',
    title: `make ${target}`,
    desc: help.get(target) || '',
    extra: target.replace(/-/g, ' '),
  }));
}

function readSkills() {
  const dirs = ['.agents/skills', '.claude/skills'];
  const seen = new Set();
  const out = [];
  for (const rel of dirs) {
    const base = join(ROOT, rel);
    let entries;
    try {
      entries = readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const file = join(base, e.name, 'SKILL.md');
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf8');
      const fm = frontmatter(text);
      const name = (fm.name || e.name).replace(/^["']|["']$/g, '');
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        kind: 'skill',
        id: name,
        path: relative(ROOT, file),
        title: name,
        desc: fm.description || firstParagraph(text) || '',
        extra: '',
      });
    }
  }
  return out;
}

function readDocs() {
  const files = [];
  walk(join(ROOT, 'docs'), files);
  walk(join(ROOT, 'knowledge'), files);
  const claudeDir = join(ROOT, '.claude');
  if (existsSync(claudeDir)) {
    for (const f of readdirSync(claudeDir)) {
      if (f.endsWith('.md') && !['workspaces.md', 'README.md'].includes(f)) {
        files.push(join(claudeDir, f));
      }
    }
  }
  for (const f of readdirSync(ROOT)) {
    if (f.endsWith('.md')) files.push(join(ROOT, f));
  }
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const fm = frontmatter(text);
    const title = fm.title || firstHeading(text) || basename(file, '.md');
    out.push({
      kind: 'doc',
      id: rel,
      path: rel,
      title,
      desc: fm.description || firstParagraph(text),
      extra: fm.tags || '',
    });
  }
  return out;
}

function prepare(item) {
  const title = item.title || '';
  const hay = [title, item.desc, item.extra, item.id].join(' ').toLowerCase();
  return {
    ...item,
    titleLower: title.toLowerCase(),
    idLower: item.id.toLowerCase(),
    hay,
    bag: tokens(hay),
    counts: (() => {
      const c = new Map();
      for (const t of tokens(hay)) c.set(t, (c.get(t) || 0) + 1);
      return c;
    })(),
  };
}

function score(item, qTokens, qStr) {
  let s = 0;
  for (const tok of qTokens) {
    const tf = item.counts.get(tok) || 0;
    if (tf) s += 2 + Math.log2(tf + 1);
    if (tok.length >= 3 && item.hay.includes(tok)) s += 1;
    if (item.titleLower.includes(tok)) s += 2;
    if (item.idLower.includes(tok)) s += 1;
  }
  if (qStr.length >= 4 && item.hay.includes(qStr)) s += 5;
  return s;
}

function rank(items, qTokens, qStr, limit) {
  return items
    .map((it) => ({ ...it, score: score(it, qTokens, qStr) }))
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const list = argv.includes('--list');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? Number(argv[limitIdx + 1]) || 3 : 3;
  const qStr = argv
    .filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--limit')
    .join(' ')
    .trim();

  const make = readMakefile().map(prepare);
  const skills = readSkills().map(prepare);
  const docs = readDocs().map(prepare);

  if (list) {
    const payload = {
      make: make.length,
      skills: skills.length,
      docs: docs.length,
      sources: ['Makefile', '.agents/skills', '.claude/skills', 'docs/', 'knowledge/', '*.md', '.claude/*.md'],
    };
    console.log(json ? JSON.stringify(payload, null, 2) : `Indexed: ${payload.make} make targets, ${payload.skills} skills, ${payload.docs} docs`);
    return;
  }

  if (!qStr) {
    console.error('Usage: node scripts/agent-router.mjs "<task>" [--json] [--limit N]');
    console.error('       node scripts/agent-router.mjs --list');
    process.exit(2);
  }

  const qTokens = tokens(qStr);
  const results = {
    skills: rank(skills, qTokens, qStr.toLowerCase(), limit),
    docs: rank(docs, qTokens, qStr.toLowerCase(), limit),
    make: rank(make, qTokens, qStr.toLowerCase(), limit),
  };

  if (json) {
    const clean = (r) => ({
      kind: r.kind,
      id: r.id,
      path: r.path,
      title: r.title,
      desc: r.desc,
      score: Math.round(r.score * 10) / 10,
    });
    console.log(JSON.stringify({
      query: qStr,
      indexed: { make: make.length, skills: skills.length, docs: docs.length },
      results: {
        skills: results.skills.map(clean),
        docs: results.docs.map(clean),
        make: results.make.map(clean),
      },
    }, null, 2));
    return;
  }

  console.log(`Task: ${qStr}`);
  console.log(`Routed over ${make.length} make targets, ${skills.length} skills, ${docs.length} docs (deterministic, no LLM)\n`);

  const sections = [
    ['SKILL', results.skills, (r) => `load skill "${r.id}"  (${r.path})`],
    ['SOP', results.docs, (r) => `read ${r.path}  — ${r.title}`],
    ['MAKE', results.make, (r) => `run make ${r.id}  — ${r.desc || '(no description)'}`],
  ];

  let any = false;
  for (const [label, rows, fmt] of sections) {
    if (!rows.length) continue;
    any = true;
    console.log(`${label}`);
    for (const r of rows) console.log(`  [${String(Math.round(r.score)).padStart(4)}] ${fmt(r)}`);
    console.log('');
  }

  if (!any) {
    console.log('No match. Fallbacks:');
    console.log('  make help                         # all make targets');
    console.log(`  graphify query "${qStr}"          # code paths (graphify-out/)`);
    console.log('  docs/AGENT_NAVIGATION_GUIDE.md   # static domain matrix');
    return;
  }

  const hint = [];
  if (results.skills[0]) hint.push(`load skill: ${results.skills[0].id}`);
  if (results.docs[0]) hint.push(`read: ${results.docs[0].path}`);
  if (results.make[0]) hint.push(`run: make ${results.make[0].id}`);
  hint.push(`code: graphify query "${qStr}"`);
  console.log('Next:');
  for (const h of hint) console.log(`  - ${h}`);
}

main();
