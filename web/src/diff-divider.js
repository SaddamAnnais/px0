let leftPanePercent = 50;

export function createDiffDivider() {
  const divider = document.createElement('div');
  divider.className = 'diff-divider';
  divider.tabIndex = 0;
  divider.title = 'Drag to resize diff panes; double-click to reset';
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-label', 'Resize diff panes');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.setAttribute('aria-valuemin', '20');
  divider.setAttribute('aria-valuemax', '80');
  divider.setAttribute('aria-valuenow', String(Math.round(leftPanePercent)));
  return divider;
}

export function initDiffDivider(content) {
  function setPanePercent(percent) {
    leftPanePercent = Math.max(20, Math.min(80, percent));
    content.style.setProperty('--diff-left-width', leftPanePercent + '%');
    for (const divider of content.querySelectorAll('.diff-divider')) {
      divider.setAttribute('aria-valuenow', String(Math.round(leftPanePercent)));
    }
  }

  function savePanePercent() {
    try { localStorage.setItem('px0.diffLeftPercent', String(leftPanePercent)); } catch {}
  }

  try {
    const savedPercent = Number(localStorage.getItem('px0.diffLeftPercent'));
    if (savedPercent >= 20 && savedPercent <= 80) leftPanePercent = savedPercent;
  } catch {}
  setPanePercent(leftPanePercent);

  content.addEventListener('pointerdown', event => {
    const divider = event.target.closest('.diff-divider');
    if (!divider || event.button !== 0) return;
    event.preventDefault();
    divider.focus({ preventScroll: true });
    const table = divider.closest('.diff-split');
    const bounds = table.getBoundingClientRect();
    divider.setPointerCapture(event.pointerId);
    content.classList.add('diff-resizing');
    const resize = move => setPanePercent((move.clientX - bounds.left) / bounds.width * 100);
    const finish = () => {
      divider.removeEventListener('pointermove', resize);
      divider.removeEventListener('lostpointercapture', finish);
      content.classList.remove('diff-resizing');
      savePanePercent();
    };
    divider.addEventListener('pointermove', resize);
    divider.addEventListener('lostpointercapture', finish);
  });

  content.addEventListener('dblclick', event => {
    if (!event.target.closest('.diff-divider')) return;
    event.preventDefault();
    setPanePercent(50);
    savePanePercent();
  });

  content.addEventListener('keydown', event => {
    if (!event.target.closest('.diff-divider')) return;
    let percent;
    if (event.key === 'ArrowLeft') percent = leftPanePercent - (event.shiftKey ? 10 : 2);
    else if (event.key === 'ArrowRight') percent = leftPanePercent + (event.shiftKey ? 10 : 2);
    else if (event.key === 'Home') percent = 20;
    else if (event.key === 'End') percent = 80;
    else return;
    event.preventDefault();
    event.stopPropagation();
    setPanePercent(percent);
    savePanePercent();
  });
}
