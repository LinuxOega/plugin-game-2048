import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const gameDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/main/resources/static/game'
);

const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://example.com/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const doc = window.document;
const runtimeErrors = [];
window.addEventListener('error', (event) => runtimeErrors.push(event.message));

// Deterministic opening board: two "2" tiles in row 0 -> ArrowLeft merges to 4.
window.Math.random = () => 0;
window.eval(fs.readFileSync(path.join(gameDir, 'game-core.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(gameDir, 'app.js'), 'utf8'));

const cells = () => [...doc.querySelectorAll('#board .cell')];
const filled = () => cells().filter((cell) => cell.textContent !== '');
const press = (key) => window.dispatchEvent(
  new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
);

test('standalone page boots without runtime errors', async (t) => {
  assert.deepEqual(runtimeErrors, []);
  assert.equal(cells().length, 16);
  assert.equal(filled().length, 2);
  assert.equal(doc.getElementById('score').textContent, '0');
  assert.equal(doc.getElementById('undo').disabled, true);
  assert.equal(doc.getElementById('rank-title').textContent, '本地排行榜',
    'outside Halo the page falls back to a browser-local leaderboard');

  await t.test('keyboard move merges tiles and accumulates score', () => {
    press('ArrowLeft');
    assert.equal(doc.getElementById('score').textContent, '4');
    assert.equal(doc.getElementById('moves').textContent, '1');
    assert.equal(doc.getElementById('undo').disabled, false);
  });

  await t.test('undo restores the previous board', () => {
    doc.getElementById('undo').click();
    assert.equal(doc.getElementById('score').textContent, '0');
    assert.equal(doc.getElementById('moves').textContent, '0');
    assert.equal(doc.getElementById('undo').disabled, true);
  });

  await t.test('player names are rendered as text, never as HTML', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    doc.getElementById('player').value = malicious;
    doc.getElementById('submit').click();
    assert.equal(doc.querySelectorAll('#rank-list li').length, 1);
    const shown = doc.querySelector('#rank-list .name').textContent;
    assert.ok(shown.startsWith('<img'));
    assert.ok(shown.length <= 24, 'maxlength truncates overlong names');
    assert.equal(doc.querySelector('#rank-list img'), null);
    assert.equal(doc.getElementById('submit').disabled, true,
      'one submission per game');
  });

  await t.test('new game resets score, buttons and board', () => {
    doc.getElementById('new-game').click();
    assert.equal(doc.getElementById('score').textContent, '0');
    assert.equal(doc.getElementById('submit').disabled, false);
    assert.equal(filled().length, 2);
  });

  await t.test('keys typed into the nickname input do not move tiles', () => {
    doc.getElementById('player').value = 'tester';
    const event = new window.KeyboardEvent('keydown', {
      key: 'ArrowLeft', bubbles: true, cancelable: true,
    });
    doc.getElementById('player').dispatchEvent(event);
    assert.equal(doc.getElementById('moves').textContent, '0');
  });

  assert.deepEqual(runtimeErrors, []);
});
