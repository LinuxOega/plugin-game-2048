/**
 * Optional bridge for Halo themes that do NOT persist their colour scheme in
 * localStorage. Paste into: Halo Console -> Settings -> Code Injection -> Footer.
 *
 * Ethereal 2.x already writes localStorage.theme / __user_chose_theme / hue,
 * so the game page syncs itself and this file is normally NOT needed. It is
 * provided for custom themes or for a stricter immediate sync on switch.
 *
 * Looks for <iframe data-game2048>, then forwards the host's public colour
 * marker (data-color-scheme / .dark) and --hue over same-origin postMessage.
 */
(function () {
  'use strict';
  var frame = document.querySelector('iframe[data-game2048]');
  if (!frame) return;

  function currentScheme() {
    var root = document.documentElement;
    var mode = root.dataset.colorScheme || '';
    if (mode === 'auto' || mode === 'light' || mode === 'dark') return mode;
    return root.classList.contains('dark') ? 'dark' : 'auto';
  }

  function send() {
    var target = frame.contentWindow;
    if (!target) return;
    var hue = getComputedStyle(document.documentElement)
      .getPropertyValue('--hue').trim();
    target.postMessage({
      type: 'game2048:theme',
      scheme: currentScheme(),
      hue: /^\d+$/.test(hue) ? hue : '250'
    }, location.origin);
  }

  frame.addEventListener('load', send);
  if (window.MutationObserver) {
    new MutationObserver(send).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-color-scheme', 'style']
    });
  }
  send();
})();
