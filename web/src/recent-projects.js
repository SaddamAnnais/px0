let recentProjectsDialog = null;
let recentProjectsInput = null;
let recentProjectsList = null;
let recentProjectsStatus = null;
let recentProjectItems = [];
let recentProjectMatches = [];
let recentProjectSelection = 0;
let recentProjectsBase = null;
let recentProjectsResolveBase = null;
let recentProjectsRequest = 0;

function recentProjectScore(query, text) {
  const value = text.toLowerCase();
  const contiguous = value.indexOf(query);
  if (contiguous >= 0) return contiguous;
  let position = -1;
  let gaps = 0;
  for (const character of query) {
    const next = value.indexOf(character, position + 1);
    if (next < 0) return Infinity;
    gaps += next - position - 1;
    position = next;
  }
  return 1000 + gaps;
}

function renderRecentProjects() {
  const query = recentProjectsInput.value.trim().toLowerCase();
  recentProjectMatches = recentProjectItems.map((item, order) => {
    const name = item.title || item.path || item.url || item.repo || 'Project';
    const nameScore = recentProjectScore(query, name);
    const pathPosition = (item.path || item.url || '').toLowerCase().indexOf(query);
    const pathScore = pathPosition >= 0 ? pathPosition : Infinity;
    return { item, name, order, score: Math.min(nameScore, pathScore + 500) };
  }).filter(match => Number.isFinite(match.score))
    .sort((a, b) => query ? a.score - b.score || a.order - b.order : a.order - b.order);
  recentProjectSelection = Math.max(0, Math.min(recentProjectSelection, recentProjectMatches.length - 1));
  recentProjectsList.replaceChildren();
  for (const [index, match] of recentProjectMatches.entries()) {
    const row = document.createElement('a');
    row.id = `recent-project-${index}`;
    row.href = new URL(match.item.href, recentProjectsBase).href;
    row.className = 'recent-project-row';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(index === recentProjectSelection));
    row.tabIndex = -1;
    const title = document.createElement('strong');
    title.textContent = match.name;
    const path = document.createElement('span');
    path.textContent = match.item.path || match.item.url || match.item.repo || '';
    row.append(title, path);
    recentProjectsList.appendChild(row);
  }
  recentProjectsStatus.textContent = recentProjectMatches.length
    ? `${recentProjectMatches.length} recent project${recentProjectMatches.length === 1 ? '' : 's'} · ↑↓ select · Enter open · Esc close`
    : query ? 'No matching recent projects.' : 'No recent projects yet. Open a folder from the Workbench first.';
  updateRecentProjectSelection();
}

function updateRecentProjectSelection() {
  for (const [index, row] of [...recentProjectsList.children].entries()) {
    row.setAttribute('aria-selected', String(index === recentProjectSelection));
  }
  const selected = recentProjectsList.children[recentProjectSelection];
  if (selected) {
    recentProjectsInput.setAttribute('aria-activedescendant', selected.id);
    selected.scrollIntoView({ block: 'nearest' });
  } else {
    recentProjectsInput.removeAttribute('aria-activedescendant');
  }
}

export async function openRecentProjects() {
  if (!recentProjectsDialog) return;
  if (recentProjectsDialog.open) {
    recentProjectsInput.focus();
    recentProjectsInput.select();
    return;
  }
  const request = ++recentProjectsRequest;
  recentProjectsBase = new URL(recentProjectsResolveBase(), document.baseURI);
  recentProjectsInput.value = '';
  recentProjectSelection = 0;
  recentProjectItems = [];
  recentProjectMatches = [];
  recentProjectsList.replaceChildren();
  recentProjectsStatus.textContent = 'Loading recent projects…';
  recentProjectsDialog.showModal();
  recentProjectsInput.focus();
  try {
    const response = await fetch(new URL('api/wb/state', recentProjectsBase), { signal: AbortSignal.timeout(10000) });
    const state = await response.json();
    if (!response.ok || state.error) throw new Error(state.error || 'Could not load recent projects');
    if (request !== recentProjectsRequest || !recentProjectsDialog.open) return;
    recentProjectItems = (state.items || []).slice().sort((a, b) => b.lastOpened - a.lastOpened);
    renderRecentProjects();
  } catch (error) {
    if (request === recentProjectsRequest && recentProjectsDialog.open) recentProjectsStatus.textContent = error.message;
  }
}

export function initRecentProjects(resolveBase) {
  recentProjectsResolveBase = resolveBase;
  recentProjectsDialog = document.createElement('dialog');
  recentProjectsDialog.id = 'recent-projects-dialog';
  recentProjectsDialog.setAttribute('aria-labelledby', 'recent-projects-title');
  recentProjectsDialog.innerHTML = `<header><h2 id="recent-projects-title">Open Recent Project</h2><button type="button" aria-label="Close recent projects">×</button></header>
    <input id="recent-projects-search" type="text" role="combobox" aria-label="Search recent projects" aria-expanded="true" aria-controls="recent-projects-list" aria-autocomplete="list" placeholder="Search by project name or path…" autocomplete="off" spellcheck="false">
    <div id="recent-projects-list" role="listbox" aria-label="Recent projects"></div>
    <p id="recent-projects-status" role="status"></p>`;
  document.body.appendChild(recentProjectsDialog);
  recentProjectsInput = recentProjectsDialog.querySelector('input');
  recentProjectsList = recentProjectsDialog.querySelector('[role="listbox"]');
  recentProjectsStatus = recentProjectsDialog.querySelector('[role="status"]');
  recentProjectsDialog.querySelector('button').addEventListener('click', () => recentProjectsDialog.close());
  recentProjectsDialog.addEventListener('click', event => {
    if (event.target === recentProjectsDialog) recentProjectsDialog.close();
  });
  recentProjectsInput.addEventListener('input', () => {
    recentProjectSelection = 0;
    renderRecentProjects();
  });
  addEventListener('keydown', event => {
    if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRecentProjects();
      return;
    }
    if (!recentProjectsDialog.open) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      recentProjectsDialog.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = recentProjectMatches.length;
      if (count) recentProjectSelection = (recentProjectSelection + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
      updateRecentProjectSelection();
    } else if (event.key === 'Enter' && document.activeElement === recentProjectsInput) {
      event.preventDefault();
      const selected = recentProjectsList.children[recentProjectSelection];
      if (selected) location.assign(selected.href);
    }
  }, { capture: true });
}
