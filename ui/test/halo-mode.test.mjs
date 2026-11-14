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
const API_BASE = '/apis/api.game2048.halo.run/v1alpha1/scores';

const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  // The /plugins/ segment switches the page into Halo online mode.
  url: 'https://example.com/plugins/plugin-game-2048/assets/game/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const doc = window.document;
const calls = [];

window.fetch = (url, options = {}) => {
  calls.push({ url, options });
  const payload = options.method === 'POST'
    ? { player: 'tester', score: 0, maxTile: 2, moves: 0, won: false, createdAt: null }
    : [{ player: '榜一', score: 9999, maxTile: 1024, moves: 500, won: false, createdAt: null }];
  return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
};

window.Math.random = () => 0;
window.eval(fs.readFileSync(path.join(gameDir, 'game-core.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(gameDir, 'app.js'), 'utf8'));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Halo online mode talks to the plugin leaderboard API', async (t) => {
  await t.test('loads the site-wide leaderboard on boot', async () => {
    await flush();
    assert.equal(doc.getElementById('rank-title').textContent, '全站排行榜');
    assert.equal(calls[0].url, `${API_BASE}?size=10`);
    assert.equal(doc.querySelectorAll('#rank-list li').length, 1);
    assert.equal(doc.querySelector('#rank-list .score').textContent, '9999');
  });

  await t.test('submits a score with the expected payload', async () => {
    doc.getElementById('player').value = 'tester';
    doc.getElementById('submit').click();
    await flush();
    const post = calls.find((call) => call.options.method === 'POST');
    assert.ok(post, 'POST /scores was issued');
    assert.equal(post.url, API_BASE);
    assert.equal(post.options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(post.options.body);
    assert.equal(body.player, 'tester');
    assert.equal(body.score, 0);
    assert.equal(body.maxTile, 2);
    assert.equal(body.won, false);
    assert.equal(doc.getElementById('submit').disabled, true);
  });

  await t.test('falls back to the local board when the API fails', async () => {
    window.fetch = () => Promise.reject(new Error('network down'));
    doc.getElementById('refresh').click();
    await flush();
    assert.ok(doc.getElementById('status').textContent.includes('本地排行榜'));
  });
});
