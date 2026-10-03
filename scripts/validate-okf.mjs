#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const bundleDir = process.argv[2] || 'knowledge';
const resolvedBundleDir = path.resolve(process.cwd(), bundleDir);

if (!fs.existsSync(resolvedBundleDir)) {
  console.error(`❌ OKF Error: Bundle directory not found: ${resolvedBundleDir}`);
  process.exit(1);
}

console.log(`🔍 Validating Open Knowledge Format (OKF) Bundle at: ${resolvedBundleDir}\n`);

let hasError = false;
let conceptCount = 0;
const typeCounts = {};
const allFiles = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      allFiles.push(fullPath);
    }
  }
}

scanDir(resolvedBundleDir);

// 1. Check Root index.md
const rootIndex = path.join(resolvedBundleDir, 'index.md');
if (!fs.existsSync(rootIndex)) {
  console.error(`❌ [FAIL] Missing root index.md in bundle`);
  hasError = true;
} else {
  const content = fs.readFileSync(rootIndex, 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    console.error(`❌ [FAIL] Root index.md must contain YAML frontmatter declaring okf_version`);
    hasError = true;
  } else {
    const fm = frontmatterMatch[1];
    if (!fm.includes('okf_version:')) {
      console.error(`❌ [FAIL] Root index.md frontmatter must declare okf_version (e.g. okf_version: "0.2")`);
      hasError = true;
    } else {
      console.log(`✅ [PASS] Root index.md contains okf_version declaration`);
    }
  }
}

// 2. Check Root log.md
const rootLog = path.join(resolvedBundleDir, 'log.md');
if (!fs.existsSync(rootLog)) {
  console.error(`❌ [FAIL] Missing root log.md in bundle`);
  hasError = true;
} else {
  console.log(`✅ [PASS] Root log.md present`);
}

// 3. Check Concepts
for (const filePath of allFiles) {
  const relPath = path.relative(resolvedBundleDir, filePath);
  const fileName = path.basename(filePath);

  if (fileName === 'index.md' || fileName === 'log.md') {
    continue;
  }

  conceptCount++;
  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!fmMatch) {
    console.error(`❌ [FAIL] ${relPath}: Missing YAML frontmatter`);
    hasError = true;
    continue;
  }

  const fm = fmMatch[1];
  const typeMatch = fm.match(/^type:\s*["']?([a-zA-Z0-9_\-]+)["']?/m);
  if (!typeMatch || !typeMatch[1]) {
    console.error(`❌ [FAIL] ${relPath}: Missing or empty 'type' field in frontmatter (OKF required)`);
    hasError = true;
    continue;
  }

  const conceptType = typeMatch[1];
  typeCounts[conceptType] = (typeCounts[conceptType] || 0) + 1;

  // Check internal links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkTarget = match[2];
    if (
      linkTarget.startsWith('http://') ||
      linkTarget.startsWith('https://') ||
      linkTarget.startsWith('#') ||
      linkTarget.startsWith('mailto:')
    ) {
      continue;
    }

    const cleanTarget = linkTarget.split('#')[0];
    if (!cleanTarget) continue;

    const targetPath = path.resolve(path.dirname(filePath), cleanTarget);
    if (!fs.existsSync(targetPath)) {
      console.error(`❌ [FAIL] ${relPath}: Broken link -> ${linkTarget} (resolved: ${targetPath})`);
      hasError = true;
    }
  }
}

console.log('\n--- Validation Summary ---');
console.log(`Total Concept Documents: ${conceptCount}`);
console.log('Concepts by Type:');
for (const [t, count] of Object.entries(typeCounts)) {
  console.log(`  - ${t}: ${count}`);
}

if (hasError) {
  console.log('\n❌ OKF validation FAILED. See errors above.\n');
  process.exit(1);
} else {
  console.log('\n✨ OKF validation PASSED! All documents conform to OKF v0.2 specification.\n');
}
