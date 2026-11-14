import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gameDir = path.join(root, 'src/main/resources/static/game');
const etherealDir = path.join(root, 'deploy/ethereal');

const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(gameDir, 'game-core.js'), 'utf8');
const app = fs.readFileSync(path.join(gameDir, 'app.js'), 'utf8');
const HALO_URL = 'https://mlingxi.cn/plugins/plugin-game-2048/assets/game/index.html';
const GAME_PATH = '/plugins/plugin-game-2048/assets/game/index.html';

function boot({ url = HALO_URL, config, storage = {} } = {}) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Math.random = () => 0;
      window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      for (const [key, value] of Object.entries(storage)) {
        window.localStorage.setItem(key, value);
      }
      if (config) window.GAME2048_CONFIG = config;
    },
  });
  dom.window.eval(core);
  dom.window.eval(app);
  return dom.window;
}

const rootEl = (window) => window.document.documentElement;

test('auto-detects Ethereal and follows the stored dark scheme and hue', () => {
  const window = boot({
    storage: { theme: 'dark', __user_chose_theme: 'true', hue: '280' },
  });
  const el = rootEl(window);
  assert.ok(el.classList.contains('theme-ethereal'), 'Ethereal skin enabled');
  assert.ok(el.classList.contains('dark'), 'dark class mirrors :root.dark');
  assert.ok(el.classList.contains('color-scheme-dark'), 'Halo public colour marker set');
  assert.equal(el.dataset.colorScheme, 'dark');
  assert.equal(el.style.getPropertyValue('--hue'), '280');
});

test('a storage event switches light/dark without reloading the game', () => {
  const window = boot({ storage: { theme: 'dark', __user_chose_theme: 'true' } });
  window.localStorage.setItem('theme', 'light');
  window.dispatchEvent(new window.Event('storage'));
  const el = rootEl(window);
  assert.equal(el.classList.contains('dark'), false);
  assert.equal(el.dataset.colorScheme, 'light');
  assert.ok(el.classList.contains('color-scheme-light'));
});

test('theme=off keeps the classic 2048 skin', () => {
  const window = boot({
    config: { theme: 'off' },
    storage: { theme: 'dark', __user_chose_theme: 'true' },
  });
  const el = rootEl(window);
  assert.equal(el.classList.contains('theme-ethereal'), false);
  assert.equal(el.classList.contains('dark'), false);
  assert.equal(el.dataset.colorScheme, undefined);
});

test('theme=ethereal forces integration with an empty localStorage', () => {
  const window = boot({ config: { theme: 'ethereal', defaultHue: 210 } });
  const el = rootEl(window);
  assert.ok(el.classList.contains('theme-ethereal'));
  assert.equal(el.dataset.colorScheme, 'auto');
  assert.equal(el.style.getPropertyValue('--hue'), '210');
});

test('a plain static blog is never restyled by unrelated localStorage keys', () => {
  const window = boot({
    url: 'https://my.blog/games/2048.html',
    storage: { theme: 'dark', __user_chose_theme: 'true' },
  });
  assert.equal(rootEl(window).classList.contains('theme-ethereal'), false);
});

test('same-origin postMessage overrides scheme and hue; other origins are ignored', () => {
  const good = boot({ storage: { theme: 'light', __user_chose_theme: 'true' } });
  good.dispatchEvent(new good.MessageEvent('message', {
    origin: good.location.origin,
    data: { type: 'game2048:theme', scheme: 'dark', hue: '310' },
  }));
  assert.ok(rootEl(good).classList.contains('dark'));
  assert.equal(rootEl(good).style.getPropertyValue('--hue'), '310');

  const bad = boot({ storage: { theme: 'light', __user_chose_theme: 'true' } });
  bad.dispatchEvent(new bad.MessageEvent('message', {
    origin: 'https://evil.example.com',
    data: { type: 'game2048:theme', scheme: 'dark' },
  }));
  assert.equal(rootEl(bad).classList.contains('dark'), false);
});

test('Ethereal snippets use theme variables, same-origin src and no scripts', () => {
  for (const name of ['embed.html', 'page.html']) {
    const raw = fs.readFileSync(path.join(etherealDir, name), 'utf8');
    const source = raw.replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(/<script/i.test(source), false, `${name} needs no script`);
    assert.match(source, new RegExp(`src="${GAME_PATH.replace(/\//g, '\\/')}"`));
    assert.match(source, /--card-bg/);
    assert.match(source, /--primary/);
    assert.match(source, /data-game2048/);
    assert.equal(/https?:\/\//.test(source), false, `${name} hard-codes no cross-origin URL`);
  }
  const bridge = fs.readFileSync(path.join(etherealDir, 'theme-bridge.js'), 'utf8');
  assert.match(bridge, /data-game2048/);
  assert.match(bridge, /postMessage/);
  assert.match(bridge, /location\.origin/);
});
