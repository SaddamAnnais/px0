import { $ } from './state.js';

let workspaceTerminal = null;
let workspaceTerminalFit = null;
let workspaceTerminalSocket = null;
let workspaceTerminalAssets = null;
let workspaceTerminalStarting = false;
let workspaceTerminalGeneration = 0;

function loadTerminalScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(path, document.baseURI).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('Could not load terminal assets')); };
    document.head.appendChild(script);
  });
}

async function loadTerminalAssets() {
  if (!workspaceTerminalAssets) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('static/vendor/xterm.css', document.baseURI).href;
    document.head.appendChild(stylesheet);
    workspaceTerminalAssets = Promise.all([
      loadTerminalScript('static/vendor/xterm.min.js'),
      loadTerminalScript('static/vendor/xterm-fit.min.js'),
      new Promise((resolve, reject) => {
        stylesheet.onload = resolve;
        stylesheet.onerror = () => reject(new Error('Could not load terminal stylesheet'));
      }),
    ]).catch(error => { workspaceTerminalAssets = null; stylesheet.remove(); throw error; });
  }
  return workspaceTerminalAssets;
}

function sendTerminalMessage(message) {
  if (workspaceTerminalSocket?.readyState === WebSocket.OPEN) {
    workspaceTerminalSocket.send(JSON.stringify(message));
  }
}

function fitWorkspaceTerminal() {
  if (!workspaceTerminal || $('#terminal-panel').hidden) return;
  workspaceTerminalFit.fit();
  sendTerminalMessage({ type: 'resize', cols: workspaceTerminal.cols, rows: workspaceTerminal.rows });
}

async function startWorkspaceTerminal() {
  if (workspaceTerminalStarting || workspaceTerminalSocket) return;
  workspaceTerminalStarting = true;
  const generation = workspaceTerminalGeneration;
  $('#terminal-state').textContent = 'Connecting…';
  try {
    await loadTerminalAssets();
    if ($('#terminal-panel').hidden || generation !== workspaceTerminalGeneration) return;
    workspaceTerminal?.dispose();
    const theme = getComputedStyle(document.documentElement);
    workspaceTerminal = new window.Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, monospace',
      scrollback: 2000,
      allowProposedApi: false,
      theme: { background: theme.getPropertyValue('--bg').trim() || '#181825', foreground: theme.getPropertyValue('--fg').trim() || '#cdd6f4' },
    });
    workspaceTerminalFit = new window.FitAddon.FitAddon();
    workspaceTerminal.loadAddon(workspaceTerminalFit);
    workspaceTerminal.open($('#terminal-surface'));
    workspaceTerminal.attachCustomKeyEventHandler(event => {
      if (event.type === 'keydown' && event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        sendTerminalMessage({ type: 'input', data: '\u0003' });
        return false;
      }
      return true;
    });
    workspaceTerminalFit.fit();
    const url = new URL('api/terminal', document.baseURI);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    workspaceTerminalSocket = socket;
    socket.binaryType = 'arraybuffer';
    workspaceTerminal.onData(data => sendTerminalMessage({ type: 'input', data }));
    socket.onopen = () => {
      if (workspaceTerminalSocket !== socket) return;
      $('#terminal-state').textContent = 'Shell';
      fitWorkspaceTerminal();
      workspaceTerminal.focus();
    };
    socket.onmessage = event => {
      if (workspaceTerminalSocket !== socket) return;
      workspaceTerminal.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
    };
    socket.onerror = () => {
      if (workspaceTerminalSocket !== socket) return;
      $('#terminal-state').textContent = 'Connection failed — open px0 on localhost';
    };
    socket.onclose = () => {
      if (workspaceTerminalSocket !== socket) return;
      workspaceTerminalSocket = null;
      $('#terminal-state').textContent = 'Stopped — click Restart to open a shell';
      workspaceTerminal.write('\r\n[Terminal disconnected]\r\n');
    };
    workspaceTerminal.focus();
  } catch (error) {
    $('#terminal-state').textContent = error.message;
  } finally {
    workspaceTerminalStarting = false;
  }
}

export function toggleWorkspaceTerminal() {
  const panel = $('#terminal-panel');
  panel.hidden = !panel.hidden;
  $('#btn-terminal').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) {
    if (workspaceTerminalSocket) {
      fitWorkspaceTerminal();
      workspaceTerminal?.focus();
    } else {
      startWorkspaceTerminal();
    }
  } else {
    $('#btn-terminal').focus();
  }
}

function stopWorkspaceTerminal() {
  workspaceTerminalGeneration++;
  const socket = workspaceTerminalSocket;
  workspaceTerminalSocket = null;
  socket?.close();
  workspaceTerminal?.dispose();
  workspaceTerminal = null;
  workspaceTerminalFit = null;
  $('#terminal-surface').replaceChildren();
  $('#terminal-state').textContent = 'Stopped — click Restart to open a shell';
}

export function initWorkspaceTerminal() {
  $('#btn-terminal').addEventListener('click', toggleWorkspaceTerminal);
  $('#terminal-hide').addEventListener('click', toggleWorkspaceTerminal);
  $('#terminal-stop').addEventListener('click', stopWorkspaceTerminal);
  $('#terminal-interrupt').addEventListener('click', () => {
    sendTerminalMessage({ type: 'input', data: '\u0003' });
    workspaceTerminal?.focus();
  });
  $('#terminal-restart').addEventListener('click', () => {
    if (!workspaceTerminalSocket && !workspaceTerminalStarting) startWorkspaceTerminal();
  });
  new ResizeObserver(fitWorkspaceTerminal).observe($('#terminal-surface'));
  addEventListener('pagehide', stopWorkspaceTerminal);
  const divider = $('#terminal-resizer');
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = $('#terminal-panel').getBoundingClientRect().height;
    const resize = move => {
      const maxHeight = Math.max(120, $('#main').clientHeight - 160);
      $('#terminal-panel').style.height = `${Math.max(120, Math.min(maxHeight, startHeight + startY - move.clientY))}px`;
      fitWorkspaceTerminal();
    };
    const finish = () => {
      divider.removeEventListener('pointermove', resize);
      divider.removeEventListener('lostpointercapture', finish);
    };
    divider.addEventListener('pointermove', resize);
    divider.addEventListener('lostpointercapture', finish);
  });
}
