import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gameDir = path.join(root, 'src/main/resources/static/game');
const deployDir = path.join(root, 'deploy');
const extDir = path.join(root, 'src/main/resources/extensions');

const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const menuYaml = fs.readFileSync(path.join(extDir, 'menu-item.yaml'), 'utf8');
const HALO_URL = 'https://mlingxi.cn/plugins/plugin-game-2048/assets/game/index.html';
const GAME_PATH = '/plugins/plugin-game-2048/assets/game/index.html';

function boot({ url = HALO_URL, config } = {}) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Math.random = () => 0;
      window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (config) window.GAME2048_CONFIG = config;
    },
  });
  dom.window.eval(fs.readFileSync(path.join(gameDir, 'game-core.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(gameDir, 'app.js'), 'utf8'));
  return dom.window.document;
}

test('preset MenuItem registers a same-origin entry in the primary menu', () => {
  const field = (key) => {
    const match = menuYaml.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  };
  assert.equal(field('apiVersion'), 'v1alpha1');
  assert.equal(field('kind'), 'MenuItem');
  assert.equal(field('menuName'), 'primary');
  assert.match(menuYaml, /^  name: plugin-game-2048-nav$/m);
  assert.equal((menuYaml.match(/href: (.+)$/gm) || []).length, 2,
    'spec.href and status.href are both set for theme rendering');
  for (const href of menuYaml.match(/href: (.+)$/gm) || []) {
    assert.equal(href.replace('href: ', '').trim(), GAME_PATH);
  }
  assert.match(menuYaml, /displayName: 2048 小游戏/);
});

test('back link appears only on a top-level Halo game page', () => {
  const topLevel = boot();
  assert.equal(topLevel.getElementById('back-link').hidden, false);
  assert.equal(topLevel.getElementById('back-link').getAttribute('href'), '/');

  const framed = boot({ config: { embedded: true } });
  assert.equal(framed.getElementById('back-link').hidden, true,
    'the host page already provides navigation when embedded');

  const local = boot({ config: { mode: 'local' } });
  assert.equal(local.getElementById('back-link').hidden, true);

  const plainBlog = boot({ url: 'https://my.blog/games/2048.html' });
  assert.equal(plainBlog.getElementById('back-link').hidden, true);
});

test('homeUrl config customises the back link', () => {
  const doc = boot({ config: { homeUrl: '/about' } });
  assert.equal(doc.getElementById('back-link').hidden, false);
  assert.equal(doc.getElementById('back-link').getAttribute('href'), '/about');
});

test('deploy snippets are same-origin, script-free and ready to paste', () => {
  const snippet = fs.readFileSync(path.join(deployDir, 'embed-snippet.html'), 'utf8');
  const page = fs.readFileSync(path.join(deployDir, 'page-2048.html'), 'utf8');
  for (const [name, raw] of [['snippet', snippet], ['page', page]]) {
    const source = raw.replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(/<script/i.test(source), false, `${name} needs no script to work`);
    assert.match(source, new RegExp(`src="${GAME_PATH.replace(/\//g, '\\/')}"`),
      `${name} uses a same-origin relative iframe src`);
    assert.equal(/https?:\/\//.test(source), false,
      `${name} must not hard-code a cross-origin URL`);
    assert.match(source, /全屏打开|新窗口/);
  }
});
