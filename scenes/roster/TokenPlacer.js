let _queue = [];
let _targetSceneId = null;
let _ghostEl = null;
let _hud = null;
let _moveFn = null;
let _downFn = null;
let _keyFn = null;
let _placing = false;

export function setPending(cloneIds, sceneId) {
  _queue = [...cloneIds];
  _targetSceneId = sceneId;
}

export function init() {
  Hooks.on('canvasReady', () => {
    if (!game.user.isGM || !_queue.length) return;
    if (canvas.scene?.id !== _targetSceneId) return;
    _startPlacement();
  });
}

function _startPlacement() {
  if (_placing || !_queue.length) return;
  if (!canvas?.ready) return;

  const actorId = _queue[0];
  const actor = game.actors.get(actorId);
  if (!actor) { _queue.shift(); _startPlacement(); return; }

  _placing = true;

  const imgSrc = actor.prototypeToken.texture.src ?? actor.img;

  _ghostEl = document.createElement('div');
  _ghostEl.className = 'sf-placer-ghost';
  _ghostEl.style.cssText = `background-image: url('${imgSrc}'); width: 96px; height: 96px;`;
  document.body.appendChild(_ghostEl);

  _hud = document.createElement('div');
  _hud.id = 'sceneforge-placer-hud';
  _hud.innerHTML = _hudHTML(actor, _queue.length);
  document.body.appendChild(_hud);

  _moveFn = (e) => {
    if (_ghostEl) {
      _ghostEl.style.left = e.clientX + 'px';
      _ghostEl.style.top = e.clientY + 'px';
    }
  };

  _downFn = async (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const pos = canvas.mousePosition;
    const size = canvas.grid.size;
    const x = Math.floor(pos.x / size) * size;
    const y = Math.floor(pos.y / size) * size;
    _cleanup();
    await _placeToken(actor, x, y);
    _advance();
  };

  _keyFn = (e) => {
    if (e.key === 'Escape') _cancel();
  };

  window.addEventListener('mousemove', _moveFn);
  window.addEventListener('mousedown', _downFn, { capture: true });
  document.addEventListener('keydown', _keyFn);
}

async function _placeToken(actor, x, y) {
  const data = actor.prototypeToken.toObject();
  delete data._id;
  await canvas.scene.createEmbeddedDocuments('Token', [{ ...data, actorId: actor.id, x, y }])
    .catch(err => console.error('SceneForge | TokenPlacer place failed:', err));
}

function _advance() {
  _placing = false;
  _queue.shift();
  if (_queue.length) {
    _startPlacement();
  } else {
    _targetSceneId = null;
    _promptActivate();
  }
}

async function _promptActivate() {
  const i18n = game.i18n;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: i18n.localize('SCENEFORGE.Place.DoneTitle') },
    content: `<p>${Handlebars.escapeExpression(i18n.localize('SCENEFORGE.Place.DonePrompt'))}</p>`,
    buttons: [
      { action: 'activate', label: i18n.localize('SCENEFORGE.Place.Activate'), default: true, callback: () => true },
      { action: 'cancel',   label: i18n.localize('SCENEFORGE.Place.NotYet'),   callback: () => null },
    ],
    rejectClose: false,
  });
  // "Not yet" resolves to its action name (a truthy string), so test for true exactly.
  if (result === true) await canvas.scene?.activate();
}

function _cancel() {
  _cleanup();
  _queue = [];
  _targetSceneId = null;
  _placing = false;
}

function _cleanup() {
  if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
  if (_hud) { _hud.remove(); _hud = null; }
  if (_moveFn) { window.removeEventListener('mousemove', _moveFn); _moveFn = null; }
  if (_downFn) { window.removeEventListener('mousedown', _downFn, { capture: true }); _downFn = null; }
  if (_keyFn) { document.removeEventListener('keydown', _keyFn); _keyFn = null; }
}

function _hudHTML(actor, remaining) {
  const esc = Handlebars.escapeExpression;
  const img = actor.prototypeToken.texture.src ?? actor.img;
  const hint = remaining > 1
    ? game.i18n.format('SCENEFORGE.Place.Remaining', { count: remaining })
    : game.i18n.localize('SCENEFORGE.Place.Last');
  return `<img src="${esc(img)}" alt="">
    <div class="sf-placer-hud__info">
      <strong class="sf-placer-hud__name">${esc(actor.name)}</strong>
      <span class="sf-placer-hud__hint">${esc(hint)}</span>
    </div>`;
}
