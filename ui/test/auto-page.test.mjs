import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contract: starting the plugin creates the public SinglePage that serves the
 * game at https://<the installing site's own domain>/game2048. Halo 2.27 keeps
 * page content in a base Snapshot, so both objects must be written; the page
 * must be published + PUBLIC + slug=game2048 for the theme route to appear.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const initializer = read('src/main/java/run/halo/game2048/Game2048PageInitializer.java');
const plugin = read('src/main/java/run/halo/game2048/Game2048Plugin.java');
const fragment = read('src/main/resources/page/game2048.html');
const fragmentBody = fragment.replace(/<!--[\s\S]*?-->/g, '');
const manualPage = read('deploy/ethereal/page.html');
const readme = read('README.md');
const manifest = read('src/main/resources/plugin.yaml');
const GAME_PATH = '/plugins/plugin-game-2048/assets/game/index.html';

test('startup writes a published public SinglePage plus its base Snapshot', () => {
  for (const token of [
    'class Game2048PageInitializer',
    'SLUG = "game2048"',
    'MANAGED_LABEL',
    'SinglePage',
    'Snapshot',
    'KEEP_RAW_ANNO',
    'setBaseSnapshot',
    'setHeadSnapshot',
    'setReleaseSnapshot',
    'setPublish(true)',
    'Post.VisibleEnum.PUBLIC',
    'SinglePage.PUBLISHED_LABEL',
    'switchIfEmpty',
    'listAll',
    'page/game2048.html',
  ]) {
    assert.ok(initializer.includes(token), `initializer must keep: ${token}`);
  }
  assert.match(plugin, /pageInitializer\.ensurePage\(\)/,
    'plugin start must trigger page creation');
  assert.match(plugin, /Retry\.backoff/,
    'page creation must tolerate a not-yet-ready extension store');
});

test('generated page fragment is same-origin relative, script-free and domain-free', () => {
  assert.doesNotMatch(fragmentBody, /https?:\/\//,
    'generated page must not contain an absolute URL');
  assert.doesNotMatch(fragmentBody, /<script/i,
    'generated page must survive editors that strip scripts');
  assert.ok(fragmentBody.includes(`src="${GAME_PATH}"`),
    'generated page keeps the same-origin relative iframe src');
  assert.match(fragmentBody, /data-game2048/);
  assert.match(fragmentBody, /<iframe/);
});

test('generated fragment matches the manual deployment fragment', () => {
  const srcOf = (text) => {
    const match = text.replace(/<!--[\s\S]*?-->/g, '').match(/<iframe[\s\S]*?src="([^"]+)"/);
    assert.ok(match, 'each fragment must contain an iframe with a src');
    return match[1];
  };
  assert.equal(srcOf(fragment), srcOf(manualPage));
  for (const text of [fragmentBody, manualPage]) {
    assert.match(text, /合并相同数字，冲上 2048/);
    assert.ok(text.includes(`href="${GAME_PATH}"`));
  }
});

test('automatic page creation never pins a concrete host', () => {
  for (const [name, text] of [
    ['Game2048PageInitializer.java', initializer],
    ['Game2048Plugin.java', plugin],
    ['page/game2048.html', fragment],
    ['plugin.yaml', manifest],
  ]) {
    assert.doesNotMatch(text, /mlingxi|example\.com|localhost:8090/i,
      `${name} must not name a host`);
    for (const match of text.matchAll(/https?:\/\/([^\s/`"'<>),]+)\/game2048/g)) {
      assert.equal(match[1], '你的域名', `${name} pins an absolute entry host`);
    }
  }
});

test('README and plugin manifest document the automatic page', () => {
  assert.match(manifest, /自动创建/,
    'plugin.yaml advertises automatic page creation');
  assert.match(readme, /自动创建|自动建页/);
  assert.match(readme, /plugin-game-2048-page/,
    'README names the generated page object for cleanup');
  assert.match(readme, /https:\/\/你的域名\/game2048/);
});
