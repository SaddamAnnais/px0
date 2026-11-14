import { $, doc_ } from './state.js';

let activeMediaDoc = null;
let player = null;

function releaseMedia() {
  if (!player) return;
  if (activeMediaDoc && Number.isFinite(player.currentTime)) activeMediaDoc.mediaPosition = player.currentTime;
  player.pause();
  player.removeAttribute('src');
  player.load();
  player = null;
  activeMediaDoc = null;
}

export function syncMediaView() {
  const doc = doc_();
  const view = $('#mediaview');
  view.hidden = !doc?.isMedia;
  if (doc === activeMediaDoc) return;
  releaseMedia();
  $('#media-surface').replaceChildren();
  if (!doc?.isMedia) return;
  activeMediaDoc = doc;
  $('#empty').hidden = true;
  $('#media-name').textContent = doc.name;
  $('#media-error').hidden = true;
  $('#media-download').href = new URL('api/raw?path=' + encodeURIComponent(doc.path), document.baseURI).href;
  player = document.createElement(doc.mediaKind);
  const mediaPlayer = player;
  mediaPlayer.controls = true;
  mediaPlayer.preload = 'metadata';
  mediaPlayer.setAttribute('aria-label', doc.name);
  if (doc.mediaKind === 'video') mediaPlayer.playsInline = true;
  mediaPlayer.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(mediaPlayer.duration) && doc.mediaPosition > 0) {
      mediaPlayer.currentTime = Math.min(doc.mediaPosition, mediaPlayer.duration);
    }
  });
  mediaPlayer.addEventListener('timeupdate', () => {
    if (player === mediaPlayer) doc.mediaPosition = mediaPlayer.currentTime;
  });
  mediaPlayer.addEventListener('error', () => {
    if (player !== mediaPlayer) return;
    $('#media-error').textContent = 'This file could not be played. Its codec may not be supported by your browser. Download it to open in another player.';
    $('#media-error').hidden = false;
  });
  $('#media-surface').append(mediaPlayer);
  mediaPlayer.src = new URL('api/media?path=' + encodeURIComponent(doc.path), document.baseURI).href;
}

addEventListener('pagehide', releaseMedia);
