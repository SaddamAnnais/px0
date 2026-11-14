import { S } from './state.js';
import { on } from './bus.js';
import { openFile, switchTab } from './tabs.js';

export async function restoreWorkspaceTabs() {
  const storageKey = 'px0.workspaceTabs:' + S.meta.root;
  let savedSession = null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && Array.isArray(stored.tabs)) savedSession = stored;
  } catch {}

  if (savedSession) {
    for (const tab of savedSession.tabs) {
      if (!tab || typeof tab.path !== 'string') continue;
      await openFile(tab.path, {
        line: Number.isInteger(tab.line) && tab.line > 0 ? tab.line : 1,
        ref: typeof tab.ref === 'string' ? tab.ref : '',
        base: typeof tab.base === 'string' ? tab.base : '',
        view: tab.view === 'diff' ? 'diff' : 'source',
        push: false,
      });
    }
    const activeIndex = S.tabs.findIndex(tab => tab.path === savedSession.activePath);
    if (activeIndex >= 0) switchTab(activeIndex);
  }

  const saveTabs = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        tabs: S.tabs.map(tab => ({
          path: tab.path, line: tab.cur, ref: tab.diffRef, base: tab.diffBase,
          view: tab.diffMode ? 'diff' : 'source',
        })),
        activePath: S.tabs[S.active]?.path || null,
      }));
    } catch {}
  };
  on('tab:activated', saveTabs);
  on('tab:closed', saveTabs);
  on('tabs:cleared', saveTabs);
  addEventListener('pagehide', saveTabs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveTabs();
  });
  return savedSession !== null;
}
