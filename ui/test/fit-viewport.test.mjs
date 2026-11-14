import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

/**
 * Contract: the game must be playable at 100% browser zoom. No shipped page
 * fragment may pin a fixed iframe height, and the game page itself must shrink
 * its board to the available viewport (runtime measurement + CSS dvh fallback).
 */
const { JSDOM } = jsdom;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

const gameDir = path.join(root, 'src/main/resources/static/game');
const html = read(gameDir, 'index.html');
const core = read(gameDir, 'game-core.js');
const app = read(gameDir, 'app.js');
const css = read(gameDir, 'style.css');

const FRAGMENTS = [
  'src/main/resources/page/game2048.html',
  'deploy/page-2048.html',
  'deploy/embed-snippet.html',
  'deploy/ethereal/page.html',
  'deploy/ethereal/embed.html',
];

// Only a fixed *height* is forbidden; the responsive breakpoint
// `@media (max-width: 720px)` is still valid CSS.
const FIXED_HEIGHT = /height:[^;"']*720px|92vh/;

test('no fixed frame height is shipped in any fragment or document', () => {
  for (const file of [...FRAGMENTS, 'README.md']) {
    assert.doesNotMatch(read(root, file), FIXED_HEIGHT,
      `${file} still pins a fixed iframe height`);
  }
});

test('all iframe fragments use viewport-relative clamped heights', () => {
  for (const file of FRAGMENTS) {
    const body = read(root, file).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(body, /<iframe/, `${file} contains an iframe`);
    assert.match(body, /100dvh/, `${file} uses dvh-relative height`);
    assert.match(body, /100vh/, `${file} keeps a vh fallback`);
    assert.match(body, /height:clamp\(/, `${file} clamps the height`);
    assert.doesNotMatch(body, /https?:\/\//, `${file} stays same-origin relative`);
  }
});

test('CSS provides a dvh board fallback and a compact embedded layout', () => {
  assert.match(css, /100dvh - 250px/);
  assert.match(css, /calc\(100vh - 250px\)/);
  assert.match(css, /html\.is-embedded body/);
  assert.match(css, /html\.is-embedded \.footer \{ display: none/);
  assert.match(css, /html\.is-embedded \.rank-panel/);
});

test('controller measures the host frame and resizes the board', () => {
  for (const pattern of [
    /function setupFitToViewport\(\)/,
    /\n  setupFitToViewport\(\);/,
    /window\.frameElement/,
    /is-embedded/,
    /frame\.style\.height/,
    /wrap\.style\.width/,
    /ResizeObserver/,
    /parent\.innerHeight/,
    /document\.fonts/,
  ]) {
    assert.match(app, pattern, `app.js missing ${pattern}`);
  }
  assert.match(app, /BOARD_MAX = 460/);
  assert.match(app, /BOARD_MIN = 220/);
});

test('standalone and single-file builds carry the same fit logic', () => {
  for (const file of [
    'standalone/game/style.css', 'standalone/game/app.js',
    'standalone/game/index.html', 'standalone/2048.html',
  ]) {
    assert.doesNotMatch(read(root, file), FIXED_HEIGHT,
      `${file} still pins a fixed height`);
  }
  assert.match(read(root, 'standalone/game/app.js'), /setupFitToViewport/);
  assert.match(read(root, 'standalone/game/style.css'), /100dvh - 250px/);
  assert.match(read(root, 'standalone/2048.html'), /setupFitToViewport/);
  assert.match(read(root, 'standalone/2048.html'), /100dvh - 250px/);
});

function boot(config) {
  const dom = new JSDOM(html, {
    url: 'https://local.invalid/game/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Math.random = () => 0;
      window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (config) window.GAME2048_CONFIG = config;
    },
  });
  dom.window.eval(core);
  dom.window.eval(app);
  return dom;
}

test('jsdom without layout degrades to the CSS fallback without errors', () => {
  const dom = boot();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.board-wrap').style.width, '',
    'no inline width is written when there is no layout engine');
  assert.equal(doc.getElementById('board').children.length, 16);
  dom.window.close();
});

test('explicit embedded config marks the document for compact layout', () => {
  const dom = boot({ mode: 'local', embedded: true });
  const doc = dom.window.document;
  assert.ok(doc.documentElement.classList.contains('is-embedded'));
  assert.equal(doc.querySelector('.board-wrap').style.width, '',
    'measurement is skipped when there is no layout engine');
  dom.window.close();
});
