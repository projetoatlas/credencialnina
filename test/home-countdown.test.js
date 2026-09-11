import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/home.js', import.meta.url), 'utf8'))
  .replace("import { initializeCardStack } from './card-stack.js';", 'const initializeCardStack = () => {};')
  .replace("import { staticEventConfig } from './site-config.js';", 'const staticEventConfig = {};');

test('countdown keeps ticking without its optional message or a config response', () => {
  const target = new Date('2026-09-17T18:30:00-03:00').getTime();
  let now = target - 7212000;
  let tick;
  let cleared = false;
  const elements = Object.fromEntries(['days', 'hours', 'minutes', 'seconds'].map(key => [`#countdown-${key}`, { textContent: '' }]));
  vm.runInNewContext(source, {
    document: { querySelector: selector => elements[selector] || null },
    Date: class extends Date { static now() { return now; } },
    fetch: () => new Promise(() => {}),
    setInterval: (callback, delay) => { assert.equal(delay, 1000); tick = callback; return 1; },
    clearInterval: () => { cleared = true; }
  });
  assert.equal(elements['#countdown-hours'].textContent, '02');
  assert.equal(elements['#countdown-seconds'].textContent, '12');
  for (const seconds of ['11', '10', '09']) {
    now += 1000;
    tick();
    assert.equal(elements['#countdown-seconds'].textContent, seconds);
  }
  now = target + 1000;
  tick();
  assert.ok(Object.values(elements).every(element => element.textContent === '00'));
  assert.equal(cleared, true);
});
