import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const standaloneDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../standalone'
);
const packDir = path.join(standaloneDir, 'game');
const singleHtml = fs.readFileSync(path.join(standaloneDir, '2048.html'), 'utf8');
const packHtml = fs.readFileSync(path.join(packDir, 'index.html'), 'utf8');

const HALO_URL = 'https://my.blog/plugins/plugin-game-2048/assets/game/index.html';

function boot({ html, inline, url, config, fetchImpl } = {}) {
  const calls = [];
  const dom = new JSDOM(html, {
    url,
    runScripts: inline ? 'dangerously' : 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Math.random = () => 0;
      window.fetch = (resource, options = {}) => {
        calls.push({ url: resource, options });
        return fetchImpl
          ? fetchImpl(resource, options)
          : Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      };
      if (config) window.GAME2048_CONFIG = config;
    },
  });
  if (!inline) {
    dom.window.eval(fs.readFileSync(path.join(packDir, 'game-core.js'), 'utf8'));
    dom.window.eval(fs.readFileSync(path.join(packDir, 'app.js'), 'utf8'));
  }
  return { window: dom.window, doc: dom.window.document, calls };
}

const press = (window, key) => window.dispatchEvent(
  new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
);

test('single-file build is fully self-contained and never calls the network', () => {
  assert.equal(/<script\s+src=/i.test(singleHtml), false, 'no external script');
  assert.equal(/<link[^>]+href="\.\/style\.css"/i.test(singleHtml), false, 'no external CSS');

  const { window, doc, calls } = boot({
    html: singleHtml,
    inline: true,
    url: 'https://my.blog/games/2048.html',
  });

  assert.equal(doc.querySelectorAll('#board .cell').length, 16);
  assert.equal(doc.getElementById('rank-title').textContent, '本地排行榜');
  assert.equal(doc.querySelector('.footer').textContent.includes('Halo 插件'), false);
  assert.deepEqual(calls, [], 'no leaderboard request on a plain blog');

  press(window, 'ArrowLeft');
  assert.equal(doc.getElementById('score').textContent, '4', 'game is playable');

  doc.getElementById('player').value = '博主';
  doc.getElementById('submit').click();
  assert.equal(doc.querySelectorAll('#rank-list li').length, 1, 'local board persists the score');
  assert.deepEqual(calls, [], 'submitting a score stays local too');
});

test('a non-Halo path that merely contains /plugins/ no longer triggers API calls', () => {
  const { doc, calls } = boot({
    html: packHtml,
    url: 'https://my.blog/plugins/demo/2048/index.html',
  });
  assert.equal(doc.getElementById('rank-title').textContent, '本地排行榜');
  assert.deepEqual(calls, [], 'the old substring heuristic is gone');
});

test('explicit apiBase points the page at a custom leaderboard endpoint', async () => {
  const { doc, calls } = boot({
    html: packHtml,
    url: 'https://my.blog/games/2048/index.html',
    config: { apiBase: 'https://rank.example.com/scores' },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(doc.getElementById('rank-title').textContent, '全站排行榜');
  assert.equal(calls[0].url, 'https://rank.example.com/scores?size=10');
});

test('mode=local forces offline play even on the Halo plugin path', () => {
  const { doc, calls } = boot({
    html: packHtml,
    url: HALO_URL,
    config: { mode: 'local' },
  });
  assert.equal(doc.getElementById('rank-title').textContent, '本地排行榜');
  assert.deepEqual(calls, []);
});
