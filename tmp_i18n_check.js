const fs = require('fs');
const path = require('path');
const glob = require('glob');
const root = path.resolve('.');
const files = glob.sync('src/**/*.{ts,tsx}', { cwd: root, absolute: true });
const keyPattern = /t\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
const usedKeys = new Set();
for (const file of files) {
  const text = fs.readFileSync(file,'utf8');
  let m;
  while ((m = keyPattern.exec(text)) !== null) {
    usedKeys.add(m[1]);
  }
}
const i18nText = fs.readFileSync(path.join('src','lib','i18n.ts'),'utf8');
const match = i18nText.match(/export const translations: Record<AppLanguage, Record<string, string>> = \{([\s\S]*)\};\n\nexport function normalizeLanguage/);
if (!match) {
  console.error('no i18n match');
  process.exit(1);
}
const body = match[1];
const entries = {};
let current = null;
for (const line of body.split('\n')) {
  const langMatch = line.match(/^  "([^"]+)": \{\s*$/);
  if (langMatch) {
    current = langMatch[1];
    entries[current] = [];
    continue;
  }
  if (!current) continue;
  const keyMatch = line.match(/^    "([^"]+)": /);
  if (keyMatch) entries[current].push(keyMatch[1]);
  if (line.trim() === '},') current = null;
}
const streetKeys = new Set(entries['en-street'] || []);
const basicKeys = new Set(entries['en-basic'] || []);
const missingInStreet = [...usedKeys].filter(k => !streetKeys.has(k));
const missingInBasic = [...usedKeys].filter(k => !basicKeys.has(k));
console.log('used keys', usedKeys.size);
console.log('basic keys', basicKeys.size, 'street keys', streetKeys.size);
console.log('missingInStreet count', missingInStreet.length);
console.log('missingInBasic count', missingInBasic.length);
if (missingInStreet.length) {
  console.log('missing in street:', missingInStreet.slice(0,100).join(', '));
}
if (missingInBasic.length) {
  console.log('missing in basic:', missingInBasic.slice(0,100).join(', '));
}
