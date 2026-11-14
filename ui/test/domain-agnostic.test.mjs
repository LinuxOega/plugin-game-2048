import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';

/**
 * Contract: this is a plugin, not a site-specific deployment. The one and only
 * public entry is https://<the installing site's own domain>/game2048. Nothing
 * in the shipped artefacts may pin a concrete hostname, and the runtime must
 * produce identical same-origin relative requests on every origin.
 */
const { JSDOM } = jsdom;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gameDir = path.join(root, 'src/main/resources/static/game');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

const html = read(gameDir, 'index.html');
const core = read(gameDir, 'game-core.js');
const app = read(gameDir, 'app.js');
const API_BASE = '/apis/api.game2048.halo.run/v1alpha1/scores';
const GAME_PATH = '/plugins/plugin-game-2048/assets/game/index.html';
const ENTRY_PLACEHOLDER = 'https://你的域名/game2048';

const SHIPPED_FILES = [
  'README.md',
  'src/main/resources/plugin.yaml',
  'src/main/resources/page/game2048.html',
  'src/main/java/run/halo/game2048/Game2048PageInitializer.java',
  'src/main/java/run/halo/game2048/Game2048Plugin.java',
  'src/main/resources/static/game/index.html',
  'src/main/resources/static/game/app.js',
  'src/main/resources/static/game/style.css',
  'src/main/resources/static/game/game-core.js',
  'deploy/embed-snippet.html',
  'deploy/page-2048.html',
  'deploy/ethereal/embed.html',
  'deploy/ethereal/page.html',
  'deploy/ethereal/theme-bridge.js',
  'standalone/2048.html',
  'standalone/game/index.html',
  'standalone/game/app.js',
];

// Matches an absolute /game2048 entry such as https://blog.example.com/game2048
// but intentionally ignores the documented placeholder https://你的域名/game2048.
const ABSOLUTE_ENTRY = /https?:\/\/([^\s/`"'<>),]+)\/game2048/g;

test('no concrete site domain is pinned in any shipped file or document', () => {
  for (const file of SHIPPED_FILES) {
    const text = read(root, file);
    assert.doesNotMatch(text, /mlingxi/i, `${file} must not name a specific blog domain`);
    for (const match of text.matchAll(ABSOLUTE_ENTRY)) {
      assert.equal(match[1], '你的域名',
        `${file} hard-codes an absolute entry host: ${match[0]}`);
    }
  }
});

test('the domain-agnostic access convention is documented everywhere it matters', () => {
  const readme = read(root, 'README.md');
  assert.match(readme, /https:\/\/你的域名\/game2048/,
    'README states the required https://<your-domain>/game2048 convention');
  assert.match(readme, /域名无关|不绑定|零域名配置/,
    'README explains that no domain is bound');

  for (const file of ['deploy/page-2048.html', 'deploy/ethereal/page.html']) {
    assert.match(read(root, file), /https:\/\/你的域名\/game2048/,
      `${file} documents the generic entry URL`);
  }

  // Snippet bodies (comments excluded) must stay same-origin relative.
  for (const file of [
    'deploy/embed-snippet.html',
    'deploy/page-2048.html',
    'deploy/ethereal/embed.html',
    'deploy/ethereal/page.html',
  ]) {
    const source = read(root, file).replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(source, /https?:\/\//,
      `${file} must not contain an absolute URL in its body`);
    assert.match(source, new RegExp(`src="${GAME_PATH.replace(/\//g, '\\/')}"`),
      `${file} keeps the same-origin relative iframe src`);
  }
});

function boot(url, { config } = {}) {
  const calls = [];
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.Math.random = () => 0;
      window.fetch = (requestUrl, options = {}) => {
        calls.push({ url: requestUrl, options });
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      };
      if (config) window.GAME2048_CONFIG = config;
    },
  });
  dom.window.eval(core);
  dom.window.eval(app);
  return { window: dom.window, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('identical same-origin relative requests on any domain, protocol and port', async () => {
  const origins = [
    'https://blog.example.com',
    'https://my.site.cn',
    'http://localhost:8090',
    'https://192.168.1.20:8443',
  ];
  for (const origin of origins) {
    const { window, calls } = boot(`${origin}${GAME_PATH}`);
    await flush();
    assert.ok(calls.length >= 1, `${origin}: leaderboard request was issued`);
    assert.equal(calls[0].url, `${API_BASE}?size=10`, `${origin}: API base`);
    for (const call of calls) {
      assert.doesNotMatch(call.url, /^https?:\/\//,
        `${origin}: request URL must not embed an origin`);
      assert.equal(call.url.includes(new URL(origin).host), false,
        `${origin}: hostname must not leak into any request`);
    }
    assert.equal(window.document.getElementById('back-link').getAttribute('href'), '/',
      `${origin}: home link stays root-relative`);
    window.close();
  }
});

test('a Halo site behind a sub-path prefix derives its prefix from the pathname', async () => {
  const { window, calls } = boot(`https://site.example/blog${GAME_PATH}`);
  await flush();
  assert.equal(calls[0].url, `/blog${API_BASE}?size=10`,
    'leaderboard API is prefixed with the site path, still with no hostname');
  assert.equal(window.document.getElementById('back-link').getAttribute('href'), '/blog/');
  window.close();
});

test('explicit basePath / apiBase overrides remain domain-free', async () => {
  const prefixed = boot(`https://site-a.example${GAME_PATH}`, { config: { basePath: '/cms/' } });
  await flush();
  assert.equal(prefixed.calls[0].url, `/cms${API_BASE}?size=10`);
  assert.equal(prefixed.window.document.getElementById('back-link').getAttribute('href'), '/cms/');
  prefixed.window.close();

  const custom = boot(`https://site-b.example${GAME_PATH}`, { config: { apiBase: '/custom/scores' } });
  await flush();
  assert.equal(custom.calls[0].url, '/custom/scores?size=10');
  custom.window.close();
});
