/**
 * Standalone 2048 page controller.
 *
 * Runs in two modes:
 *  - Under Halo (/plugins/<name>/assets/game/index.html): uses the plugin's
 *    public leaderboard API for the site-wide ranking.
 *  - Opened directly as a local file (or any non-Halo host): falls back to a
 *    browser-local leaderboard so the page is still fully playable.
 *
 * Domain-agnostic by design: every URL here is a same-origin, root-relative
 * path. No hostname, protocol or port is ever hard-coded, so the very same
 * JAR works at the /game2048 custom page on every site it is installed on.
 */
(function () {
  'use strict';

  const core = window.Game2048Core;
  if (!core) {
    document.body.textContent = '游戏核心加载失败，请检查 game-core.js 是否存在。';
    return;
  }

  const BEST_KEY = 'halo-game2048-best';
  const NAME_KEY = 'halo-game2048-player';
  const LOCAL_KEY = 'halo-game2048-local-board';
  const DEFAULT_API_BASE = '/apis/api.game2048.halo.run/v1alpha1/scores';
  // Captures an optional site prefix when Halo is proxied under a sub-path
  // (e.g. /blog/plugins/...). Only the pathname is inspected: the origin is
  // never read, so one build serves any domain, protocol and port.
  const HALO_GAME_PATH = /^(.*?)\/plugins\/plugin-game-2048\/assets\/game\//;
  const HTTP = location.protocol === 'http:' || location.protocol === 'https:';
  const config = (window.GAME2048_CONFIG && typeof window.GAME2048_CONFIG === 'object')
    ? window.GAME2048_CONFIG
    : {};
  const haloPath = HTTP ? location.pathname.match(HALO_GAME_PATH) : null;
  const siteBase = typeof config.basePath === 'string'
    ? config.basePath.replace(/\/+$/, '')
    : (haloPath ? haloPath[1] : '');

  // Mode resolution (most explicit wins):
  //   1. GAME2048_CONFIG.mode = 'local'   -> never touch the network.
  //   2. GAME2048_CONFIG.apiBase = '...'  -> custom leaderboard endpoint.
  //   3. Served from the plugin's own ReverseProxy path -> Halo leaderboard API.
  //   4. Any other host/path (static blog, object storage, file://) -> local board.
  // The old heuristic matched any path containing /plugins/, which could make a
  // plain blog fire a doomed request to /apis/... on every visit.
  let API_BASE = null;
  if (config.mode === 'local') {
    API_BASE = null;
  } else if (typeof config.apiBase === 'string' && config.apiBase.trim()) {
    API_BASE = config.apiBase.trim();
  } else if (haloPath) {
    // '' for a root deployment, '/blog' when Halo lives under a sub-path.
    API_BASE = `${siteBase}${DEFAULT_API_BASE}`;
  }

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const scoreEl = $('score');
  const bestEl = $('best');
  const movesEl = $('moves');
  const maxTileEl = $('max-tile');
  const overlayEl = $('overlay');
  const overDetailEl = $('over-detail');
  const statusEl = $('status');
  const playerInput = $('player');
  const undoBtn = $('undo');
  const submitBtn = $('submit');
  const rankList = $('rank-list');
  const rankEmpty = $('rank-empty');
  const rankTitle = $('rank-title');

  // A top-level Halo page is reachable from the site's navigation menu, so give
  // visitors a way back. Inside an iframe the host page already has navigation,
  // and static/local deployments never show this link. `embedded: true` is an
  // explicit override for sandboxed frames where window.top is not comparable.
  const backLink = $('back-link');
  const embedded = config.embedded === true || window.self !== window.top;
  if (backLink && API_BASE && !embedded) {
    backLink.href = typeof config.homeUrl === 'string' && config.homeUrl.trim()
      ? config.homeUrl.trim()
      : (siteBase ? `${siteBase}/` : '/');
    backLink.hidden = false;
  }

  let best = readNumber(BEST_KEY);
  let state = { board: core.createInitialState(4).board, score: 0, won: false };
  let history = null;
  let moves = 0;
  let over = false;
  let submitted = false;

  function readText(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeText(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  function readNumber(key) {
    const n = Number(readText(key));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // ---- Halo / Ethereal theme integration ---------------------------------
  // The game page is a standalone document served through ReverseProxy, so it
  // does not inherit the theme's CSS variables. Ethereal (Fuwari-style, Astro)
  // keeps its colour scheme in same-origin localStorage and defines --hue,
  // --primary, --card-bg ... on :root / :root.dark. Sharing the origin lets us
  // read those values and follow the visitor's light/dark and hue switches via
  // `storage` events, without touching theme files or injecting any script.
  const THEME_KEYS = ['theme', '__user_chose_theme', 'hue', 'bannerDisplay'];
  const SCHEME_CLASSES = ['color-scheme-auto', 'color-scheme-light', 'color-scheme-dark'];

  function setupThemeSync() {
    const root = document.documentElement;
    const preference = config.theme; // undefined (auto) | 'ethereal' | 'off'
    if (preference === 'off') return;

    const forced = preference === 'ethereal';
    // Only auto-detect on Halo deployments: a plain static blog may share
    // localStorage keys with unrelated scripts and should keep the classic skin.
    const detected = forced || (!!API_BASE && THEME_KEYS.some((key) => readText(key) !== null));
    if (!detected) return;

    root.classList.add('theme-ethereal');
    let override = null; // optional same-origin postMessage from the host page
    let overrideHue = null;

    function systemDark() {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function resolveMode() {
      if (override === 'light' || override === 'dark' || override === 'auto') return override;
      // Mirrors Ethereal's boot script: only honour localStorage.theme when the
      // visitor has explicitly chosen a scheme.
      const userChose = readText('__user_chose_theme') !== null;
      const stored = userChose ? readText('theme') : null;
      return stored === 'light' || stored === 'dark' ? stored : 'auto';
    }
    function apply() {
      const mode = resolveMode();
      const dark = mode === 'dark' || (mode === 'auto' && systemDark());
      root.classList.toggle('dark', dark);
      root.classList.remove(...SCHEME_CLASSES);
      root.classList.add(`color-scheme-${mode}`);
      // Halo's public plugin colour marker (docs: theme/plugin-integration).
      root.dataset.colorScheme = mode;
      const hue = readText('hue');
      root.style.setProperty('--hue', overrideHue
        || (hue && /^\d+$/.test(hue) ? hue : String(config.defaultHue || 250)));
    }

    window.addEventListener('storage', (event) => {
      if (!event.key || THEME_KEYS.indexOf(event.key) !== -1) apply();
    });
    if (window.matchMedia) {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      if (query.addEventListener) query.addEventListener('change', apply);
      else if (query.addListener) query.addListener(apply);
    }
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'game2048:theme') return;
      if (data.scheme === 'light' || data.scheme === 'dark' || data.scheme === 'auto') {
        override = data.scheme;
      }
      if (data.hue != null && /^\d+$/.test(String(data.hue))) {
        overrideHue = String(data.hue);
      }
      apply();
    });
    apply();
  }

  // ---- Fit-to-viewport ---------------------------------------------------
  // Keep the whole game visible at 100% browser zoom. Embedded in the
  // same-origin Halo page, the iframe is resized to the space left in the host
  // viewport and the board is sized from the height left after the header,
  // toolbar and hints. Everything is measured at runtime, so it also works
  // after a window resize, a phone rotation or a theme with a taller header.
  function setupFitToViewport() {
    const root = document.documentElement;
    if (embedded) root.classList.add('is-embedded');

    const appEl = document.querySelector('.app');
    const wrap = document.querySelector('.board-wrap');
    const gameEl = document.querySelector('.game');
    if (!appEl || !wrap || !gameEl) return;
    // No layout engine (jsdom / hidden iframe): rely on the CSS dvh fallback
    // and do not register observers or timers that could outlive the document.
    const probe = appEl.getBoundingClientRect();
    if (!probe || !probe.height) return;

    let frame = null;
    try {
      if (embedded && window.frameElement && window.parent !== window) {
        frame = window.frameElement;
      }
    } catch (e) {
      frame = null; // cross-origin frame: the host keeps its own height
    }

    const num = (value) => (Number.isFinite(value) ? value : 0);
    const heightOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el || el.hidden) return 0;
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return 0;
      return el.getBoundingClientRect().height
        + num(parseFloat(style.marginTop)) + num(parseFloat(style.marginBottom));
    };

    // A small game is fine; needing to zoom out or scroll the browser is not.
    // These floors are deliberately low so the whole game stays inside one
    // 100%-zoom viewport even on short laptop screens or tall theme headers.
    const FRAME_MIN = 240;
    const FRAME_MAX = 880;
    const FRAME_GAP = 16;
    // When the theme header leaves less than this much room, scroll the host
    // page once to the frame so the game gets a full viewport instead of a tiny
    // sliver. Either way: open the page and play, no manual scroll / zoom-out.
    const COMFORT_MIN = 420;
    const BOARD_MAX = 460;
    const BOARD_MIN = 180;
    let lastFrame = -1;
    let lastBoard = -1;
    let queued = false;
    let autoScrolled = false;

    function fitFrame() {
      if (!frame || !frame.style) return;
      try {
        const host = window.parent;
        const viewport = window.parent.innerHeight;
        if (!viewport) return;
        const top = num(frame.getBoundingClientRect().top);
        // Older plugin versions created pages with a fixed 720px iframe. Always
        // resize the host frame to the space that actually remains in the
        // viewport: shrinking it is exactly what brings the game into the first
        // screen. Never skip this just because the frame starts low on the page.
        const offset = Math.max(0, Math.min(top, viewport));
        const remaining = viewport - offset - FRAME_GAP;
        const wanted = Math.round(Math.max(FRAME_MIN,
          Math.min(FRAME_MAX, remaining)));
        if (wanted !== lastFrame) {
          lastFrame = wanted;
          frame.style.height = `${wanted}px`;
        }
        if (!autoScrolled && remaining < COMFORT_MIN) {
          autoScrolled = true;
          const docTop = top + num(host.scrollY) - 8;
          if (docTop > 0 && typeof host.scrollTo === 'function') {
            host.scrollTo(0, docTop);
            const expanded = Math.round(Math.max(FRAME_MIN,
              Math.min(FRAME_MAX, viewport - 8 - FRAME_GAP)));
            if (expanded !== lastFrame) {
              lastFrame = expanded;
              frame.style.height = `${expanded}px`;
            }
          }
        }
      } catch (e) { /* restricted frame: keep host height */ }
    }

    function fitBoard() {
      const viewport = window.innerHeight || root.clientHeight;
      if (!viewport) return;
      const bodyStyle = window.getComputedStyle(document.body);
      const gameStyle = window.getComputedStyle(gameEl);
      const layoutEl = document.querySelector('.layout');
      const layoutStyle = layoutEl ? window.getComputedStyle(layoutEl) : null;
      const chrome = num(parseFloat(bodyStyle.paddingTop))
        + num(parseFloat(bodyStyle.paddingBottom))
        + num(parseFloat(gameStyle.paddingTop))
        + num(parseFloat(gameStyle.paddingBottom))
        + (layoutStyle ? num(parseFloat(layoutStyle.marginTop)) : 0)
        + heightOf('.back-link') + heightOf('.header') + heightOf('.toolbar')
        + heightOf('.status') + heightOf('.hint') + heightOf('.touch-controls')
        + heightOf('.footer') + 12;
      const availableHeight = viewport - chrome;
      const availableWidth = gameEl.clientWidth
        - num(parseFloat(gameStyle.paddingLeft))
        - num(parseFloat(gameStyle.paddingRight));
      const width = Math.max(BOARD_MIN, Math.floor(Math.min(
        BOARD_MAX, availableWidth, availableHeight
      )));
      if (width !== lastBoard) {
        lastBoard = width;
        wrap.style.width = `${width}px`;
      }
    }

    const schedule = () => {
      if (queued) return;
      queued = true;
      const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
      raf(() => {
        queued = false;
        fitFrame();
        fitBoard();
      });
    };

    fitFrame();
    schedule();
    window.addEventListener('resize', schedule);
    if (frame) {
      try {
        window.parent.addEventListener('resize', schedule);
        window.parent.addEventListener('scroll', schedule, { passive: true });
      } catch (e) { /* noop */ }
    }
    if (window.ResizeObserver) {
      new window.ResizeObserver(schedule).observe(appEl);
    }
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(schedule).catch(() => {});
    }
  }

  function readLocalBoard() {
    try {
      const rows = JSON.parse(readText(LOCAL_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function tileClass(value) {
    if (value === 0) return '';
    return value > 2048 ? 'tile-super' : `tile-${value}`;
  }
  function digitClass(value) {
    if (value >= 1024) return 'digit-4';
    if (value >= 128) return 'digit-3';
    return 'digit-2';
  }

  function syncButtons() {
    undoBtn.disabled = !history;
    submitBtn.disabled = submitted;
  }

  function render() {
    const fragment = document.createDocumentFragment();
    state.board.forEach((row) => {
      row.forEach((value) => {
        const cell = document.createElement('div');
        cell.className = ['cell', tileClass(value), digitClass(value)].filter(Boolean).join(' ');
        if (value) cell.textContent = String(value);
        fragment.appendChild(cell);
      });
    });
    boardEl.replaceChildren(fragment);
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(best);
    movesEl.textContent = String(moves);
    maxTileEl.textContent = String(core.getMaxTile(state.board));
    overlayEl.hidden = !over;
    if (over) {
      overDetailEl.textContent = `得分 ${state.score} · 最大方块 ${core.getMaxTile(state.board)}`;
    }
    syncButtons();
  }

  function renderRank(rows) {
    rankList.replaceChildren();
    rows.slice(0, 10).forEach((row, index) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'name';
      // textContent keeps player-supplied names inert (no HTML injection).
      name.textContent = String(row.player || '匿名玩家');
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = String(Number(row.score) || 0);
      li.append(rank, name, score);
      rankList.appendChild(li);
    });
    const empty = rows.length === 0;
    rankEmpty.hidden = !empty;
    rankEmpty.textContent = empty
      ? (API_BASE ? '还没有人上榜，快来占个坑' : '本地模式：成绩仅保存在此浏览器')
      : '';
  }

  function loadRank() {
    rankTitle.textContent = API_BASE ? '全站排行榜' : '本地排行榜';
    if (!API_BASE) {
      renderRank(readLocalBoard());
      return;
    }
    fetch(`${API_BASE}?size=10`, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => renderRank(Array.isArray(data) ? data : []))
      .catch(() => {
        setStatus('在线排行榜不可用，已切换为本地排行榜');
        renderRank(readLocalBoard());
      });
  }

  function saveLocal(row) {
    const rows = readLocalBoard();
    rows.push(Object.assign({ createdAt: new Date().toISOString() }, row));
    rows.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    writeText(LOCAL_KEY, JSON.stringify(rows.slice(0, 10)));
    submitted = true;
    renderRank(readLocalBoard());
    syncButtons();
  }

  function reportScore() {
    if (submitted) {
      setStatus('本局成绩已提交过');
      return;
    }
    const name = (playerInput.value || '').trim().slice(0, 24) || '匿名玩家';
    writeText(NAME_KEY, name);
    const payload = {
      player: name,
      score: state.score,
      maxTile: core.getMaxTile(state.board),
      moves: moves,
      won: state.won,
    };
    if (!API_BASE) {
      saveLocal(payload);
      setStatus('本地模式：成绩已保存在此浏览器');
      return;
    }
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(() => {
        submitted = true;
        setStatus('成绩已提交到全站排行榜');
        loadRank();
        syncButtons();
      })
      .catch(() => {
        setStatus('在线提交失败，成绩已保存到本地排行榜');
        saveLocal(payload);
      });
  }

  function newGame() {
    state = { board: core.createInitialState(4).board, score: 0, won: false };
    history = null;
    moves = 0;
    over = false;
    submitted = false;
    setStatus('');
    render();
  }

  function undo() {
    if (!history) return;
    state = { board: history.board, score: history.score, won: history.won };
    moves = history.moves;
    over = history.over;
    history = null;
    submitted = false;
    setStatus('');
    render();
  }

  function move(direction) {
    if (over) return;
    const wasWon = state.won;
    const result = core.applyTurn(state, direction);
    if (!result.moved) return;

    history = {
      board: core.cloneBoard(state.board),
      score: state.score,
      won: state.won,
      moves: moves,
      over: over,
    };
    moves += 1;
    state = { board: result.board, score: result.score, won: result.won };
    if (result.score > best) {
      best = result.score;
      writeText(BEST_KEY, String(best));
    }
    over = result.over === true || !core.hasMoves(result.board);
    if (result.won && !wasWon) setStatus('达成 2048！继续挑战更高分吧');
    render();
    if (over) reportScore();
  }

  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (target && target.isContentEditable) return;
    const direction = KEY_MAP[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });

  let touchStart = null;
  boardEl.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  boardEl.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    event.preventDefault();
    move(Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up'));
  }, { passive: false });

  $('new-game').addEventListener('click', newGame);
  $('retry').addEventListener('click', newGame);
  undoBtn.addEventListener('click', undo);
  submitBtn.addEventListener('click', reportScore);
  $('refresh').addEventListener('click', loadRank);
  playerInput.value = readText(NAME_KEY) || '';

  // Do not advertise a Halo plugin when the page is deployed on a plain blog.
  const footerEl = document.querySelector('.footer');
  if (footerEl) {
    footerEl.textContent = API_BASE
      ? 'Powered by Halo 插件 · 2048 小游戏'
      : '2048 小游戏 · 成绩仅保存在此浏览器';
  }

  setupThemeSync();
  setupFitToViewport();
  render();
  loadRank();
})();
