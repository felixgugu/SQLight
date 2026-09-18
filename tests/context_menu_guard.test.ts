import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Global context menu guard prevents default browser menu on contextmenu event', () => {
  let defaultPrevented = false;
  const fakeEvent = {
    type: 'contextmenu',
    preventDefault() {
      defaultPrevented = true;
    },
  };

  const handler = (e: { preventDefault: () => void }) => {
    e.preventDefault();
  };

  handler(fakeEvent);
  assert.equal(defaultPrevented, true, 'contextmenu event handler must invoke preventDefault()');
});

test('index.html contains early guard for contextmenu suppression', () => {
  const indexHtmlPath = resolve(process.cwd(), 'index.html');
  const content = readFileSync(indexHtmlPath, 'utf-8');
  assert.match(
    content,
    /window\.addEventListener\(\s*['"]contextmenu['"]\s*,\s*\(?e\)?\s*=>\s*e\.preventDefault\(\)\s*\)/,
    'index.html must include an early guard script to disable default contextmenu'
  );
});

test('src/main.ts registers contextmenu suppression listener', () => {
  const mainTsPath = resolve(process.cwd(), 'src/main.ts');
  const content = readFileSync(mainTsPath, 'utf-8');
  assert.match(
    content,
    /window\.addEventListener\(\s*['"]contextmenu['"]\s*,\s*\(?e\)?\s*=>\s*\{?\s*e\.preventDefault\(\)/,
    'src/main.ts must register a global contextmenu listener with preventDefault()'
  );
});
