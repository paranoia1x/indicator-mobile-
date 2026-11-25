// Ensures the shareable calculation/data-processing modules stay platform-neutral
// (no React / React Native / Expo imports) so they can be reused by the desktop app.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_DIRS = ['indicators', 'research', 'simulator', 'news/core', 'ai/core', 'market-data/core', 'security/core', 'notifications/core', 'education/content'];
const FORBIDDEN = /from\s+['"](react|react-native|expo[\w-]*|@expo\/[\w-]+|react-native-[\w-]+)(\/[^'"]*)?['"]/;

const bad = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (FORBIDDEN.test(line)) bad.push(`${p.replace(root + '/', '')}:${i + 1}: ${line.trim()}`);
      });
    }
  }
}
for (const d of CORE_DIRS) {
  try { walk(join(root, d)); } catch { /* dir may not exist yet */ }
}
if (bad.length) {
  console.error('Core purity violations (platform imports in shareable modules):\n' + bad.join('\n'));
  process.exit(1);
}
console.log(`Core purity OK (${CORE_DIRS.join(', ')})`);
