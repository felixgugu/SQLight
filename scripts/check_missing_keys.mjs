import fs from 'fs';
import path from 'path';

function getLeafPaths(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, getLeafPaths(value, currentPath));
    } else {
      result[currentPath] = String(value);
    }
  }
  return result;
}

const zhContent = fs.readFileSync('src/i18n/locales/zh-TW.ts', 'utf-8');
const zhDictMatch = zhContent.match(/export default\s*(\{[\s\S]*\});/);
const zhDict = (new Function(`return ${zhDictMatch[1]}`))();
const zhPaths = getLeafPaths(zhDict);

const enContent = fs.readFileSync('src/i18n/locales/en.ts', 'utf-8');
const enDictMatch = enContent.match(/export default\s*(\{[\s\S]*\});/);
const enDict = (new Function(`return ${enDictMatch[1]}`))();
const enPaths = getLeafPaths(enDict);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'primevue') {
        results = results.concat(walk(full));
      }
    } else if (file.endsWith('.vue') || (file.endsWith('.ts') && !file.includes('locales') && !file.includes('primevue'))) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('src');
const missingInZh = new Set();
const missingInEn = new Set();
const usedKeys = new Set();

const regex = /(?:\$t|t)\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

for (const file of files) {
  const code = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = regex.exec(code)) !== null) {
    const key = m[1];
    // skip dynamic or single letter variables
    if (!key.includes('.')) continue;
    usedKeys.add(key);
    if (!zhPaths[key]) {
      missingInZh.add(`${key} (used in ${file})`);
    }
    if (!enPaths[key]) {
      missingInEn.add(`${key} (used in ${file})`);
    }
  }
}

console.log('Total used keys across src:', usedKeys.size);
console.log('Missing in zh-TW:', Array.from(missingInZh));
console.log('Missing in en:', Array.from(missingInEn));
