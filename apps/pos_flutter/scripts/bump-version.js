const fs = require('fs');
const path = require('path');

const pubspecPath = path.resolve(__dirname, '../pubspec.yaml');
const content = fs.readFileSync(pubspecPath, 'utf8');

const versionRegex = /^version:\s*(\d+\.\d+\.\d+)\+(\d+)/m;
const match = content.match(versionRegex);

if (!match) {
  console.error('Could not find version in pubspec.yaml');
  process.exit(1);
}

const semver = match[1];
const buildNumber = parseInt(match[2], 10) + 1;
const newVersion = `${semver}+${buildNumber}`;

const newContent = content.replace(versionRegex, `version: ${newVersion}`);
fs.writeFileSync(pubspecPath, newContent, 'utf8');

console.log(`✓ Bumped Flutter version to: ${newVersion}`);
