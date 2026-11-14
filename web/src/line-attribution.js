import { $, S, doc_, api } from './state.js';
import { on } from './bus.js';

export function initLineAttribution() {
  const editor = $('#editor');
  const badge = document.createElement('button');
  badge.id = 'line-author';
  badge.type = 'button';
  badge.hidden = true;
  badge.setAttribute('aria-label', 'Show line author and commit details');
  const card = document.createElement('div');
  card.id = 'line-author-card';
  card.hidden = true;
  editor.append(badge);
  document.body.append(card);
  const cache = new Map();
  let selectedLine = null;
  let timer;
  let closeTimer;
  let generation = 0;

  function readAttribution(target, details = false) {
    const key = details && target.data?.commit
      ? 'commit:' + target.data.commit
      : [target.path, target.ref, target.line, details].join(':');
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 30000) return cached.promise;
    const promise = api('/api/line-attribution', {
      path: target.path, line: target.line, ref: target.ref, details: details ? '1' : '0',
    });
    cache.set(key, { time: Date.now(), promise });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return promise;
  }

  function closeCard() {
    clearTimeout(closeTimer);
    card.hidden = true;
  }

  function chooseLine(row) {
    const doc = doc_();
    if (!doc || !S.meta?.git || doc.isImage || !row) {
      badge.hidden = true;
      return;
    }
    const oldSide = row.classList.contains('diff-side-left') || !row.dataset.l;
    const line = Number(oldSide ? row.dataset.oldL : row.dataset.l);
    if (!line) { badge.hidden = true; return; }
    let ref = doc.diffRef || '';
    if (row.closest('#diffview') && oldSide) ref = doc.diffBase || (ref ? ref + '^' : '@diff-base');
    const target = { path: doc.path, line, ref, row, dirty: doc.dirty };
    const key = [target.path, line, ref, !!doc.dirty].join(':');
    if (selectedLine?.key === key && !badge.hidden) { positionBadge(row); return; }
    selectedLine = { ...target, key };
    closeCard();
    badge.hidden = true;
    clearTimeout(timer);
    const request = ++generation;
    timer = setTimeout(async () => {
      try {
        const data = target.dirty
          ? { available: true, local: true, summary: 'Unsaved edits — save to update line history' }
          : await readAttribution(target);
        if (request !== generation || !row.isConnected) return;
        selectedLine.data = data;
        badge.textContent = data.local ? data.summary : data.available
          ? data.author + ' · ' + new Date(data.date).toLocaleDateString()
          : 'No committed history';
        badge.dataset.label = badge.textContent;
        positionBadge(row);
        badge.hidden = false;
      } catch { if (request === generation) badge.hidden = true; }
    }, 180);
  }

  function positionBadge(row) {
    const bounds = row.getBoundingClientRect();
    const viewport = editor.getBoundingClientRect();
    const code = row.querySelector('.c, .diff-code');
    let textEnd = null;
    if (code) {
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      let lastText;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) lastText = node;
      if (lastText) {
        const range = document.createRange();
        range.setStart(lastText, lastText.length);
        range.collapse(true);
        textEnd = range.getBoundingClientRect();
      }
    }
    const rightEdge = Math.min(bounds.right, viewport.right) - 8;
    const left = Math.min((textEnd?.right || code?.getBoundingClientRect().left || bounds.left + 65) + 24, rightEdge - 24);
    const availableWidth = rightEdge - left;
    badge.textContent = availableWidth < 80 ? 'ⓘ' : badge.dataset.label;
    badge.style.top = Math.max(0, (textEnd?.height ? textEnd.top : bounds.top) - viewport.top) + 'px';
    badge.style.left = left - viewport.left + 'px';
    badge.style.maxWidth = Math.max(24, Math.min(320, availableWidth)) + 'px';
    if (bounds.bottom < viewport.top || bounds.top > viewport.bottom) badge.hidden = true;
  }

  function addText(text, className) {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    card.append(element);
  }

  function addLink(text, url) {
    if (typeof url !== 'string' || !url.startsWith('https://')) { addText(text, 'line-author-summary'); return; }
    const link = document.createElement('a');
    link.textContent = text;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
  }

  function drawCard(data, loading = false) {
    card.replaceChildren();
    if (!data.available) { addText('This line has no committed history.', 'line-author-summary'); return; }
    if (data.local) { addText(data.summary, 'line-author-summary'); return; }
    addText(data.author, 'line-author-name');
    addText(new Date(data.date).toLocaleString(), 'line-author-date');
    addText(data.summary, 'line-author-summary');
    addLink('Commit ' + data.commit.slice(0, 8), data.commitUrl);
    for (const pull of data.pulls || []) addLink('PR #' + pull.number + ' · ' + pull.title, pull.url);
    if (loading) addText('Looking up pull requests…', 'line-author-date');
    else if (data.prLookup === 'none') addText('No associated pull request found.', 'line-author-date');
    else if (data.prLookup === 'unavailable') addText('Pull request details unavailable.', 'line-author-date');
  }

  async function openCard() {
    clearTimeout(closeTimer);
    const target = selectedLine;
    if (!target?.data || badge.hidden) return;
    drawCard(target.data, target.data.available && !target.data.local);
    card.hidden = false;
    const bounds = badge.getBoundingClientRect();
    card.style.left = Math.max(8, Math.min(bounds.left, innerWidth - 390)) + 'px';
    card.style.top = Math.max(8, Math.min(bounds.bottom + 6, innerHeight - 270)) + 'px';
    if (target.data.local || !target.data.available) return;
    try {
      const details = await readAttribution(target, true);
      if (selectedLine === target && !card.hidden) drawCard(details);
    } catch {
      if (selectedLine === target && !card.hidden) drawCard({ ...target.data, prLookup: 'unavailable' });
    }
  }

  function showCurrentLine() {
    if (!$('#diffview').hidden || doc_()?.isEditing) { badge.hidden = true; return; }
    chooseLine($('#rows .row[data-l="' + (doc_()?.cur || 1) + '"]'));
  }

  editor.addEventListener('pointermove', event => {
    if (badge.contains(event.target)) return;
    const row = event.target.closest('#rows .row, #diffcontent .diff-side, #diffcontent .diff-row');
    if (row) chooseLine(row);
  });
  editor.addEventListener('pointerleave', () => {
    clearTimeout(timer);
    closeTimer = setTimeout(closeCard, 160);
  });
  editor.addEventListener('pointerup', event => {
    if (!event.target.closest('#line-author')) showCurrentLine();
  });
  addEventListener('keyup', event => {
    if (!event.target.closest('input, textarea, [contenteditable="true"], #terminal-panel')) showCurrentLine();
  });
  editor.addEventListener('scroll', () => { closeCard(); badge.hidden = true; }, true);
  badge.addEventListener('pointerenter', openCard);
  badge.addEventListener('focus', openCard);
  badge.addEventListener('click', openCard);
  badge.addEventListener('pointerleave', () => { closeTimer = setTimeout(closeCard, 160); });
  card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  card.addEventListener('pointerleave', closeCard);
  addEventListener('keydown', event => { if (event.key === 'Escape') closeCard(); });
  on('tab:activated', () => { generation++; selectedLine = null; closeCard(); showCurrentLine(); });
  on('tabs:cleared', () => { generation++; badge.hidden = true; closeCard(); });
  new MutationObserver(showCurrentLine).observe($('#rows'), { childList: true });
}
