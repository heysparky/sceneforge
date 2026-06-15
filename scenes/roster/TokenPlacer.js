let _queue = [];
let _targetSceneId = null;
let _ghost = null;
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

async function _startPlacement() {
  if (_placing || !_queue.length) return;
  if (!canvas?.ready || !canvas?.tokens) return;

  const actorId = _queue[0];
  const actor = game.actors.get(actorId);
  if (!actor) { _advance(); return; }

  _placing = true;

  const src = actor.prototypeToken.texture.src;
  const texture = await PIXI.Assets.load(src).catch(() => null);
  if (!texture) { _placing = false; _advance(); return; }

  const size = canvas.grid.size;

  _ghost = new PIXI.Sprite(texture);
  _ghost.width = size;
  _ghost.height = size;
  _ghost.alpha = 0.5;
  _ghost.anchor.set(0);
  _ghost.eventMode = 'none';
  _ghost.zIndex = 9999;
  canvas.tokens.addChild(_ghost);
  canvas.tokens.sortableChildren = true;

  _hud = document.createElement('div');
  _hud.id = 'sceneforge-placer-hud';
  _hud.innerHTML = _hudHTML(actor, _queue.length);
  document.body.appendChild(_hud);

  const gridSize = canvas.grid.size;

  _moveFn = (e) => {
    if (!_ghost) return;
    const local = canvas.tokens.toLocal(e.global);
    const sx = Math.floor(local.x / gridSize) * gridSize;
    const sy = Math.floor(local.y / gridSize) * gridSize;
    _ghost.position.set(sx, sy);
  };

  _downFn = async (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const local = canvas.tokens.toLocal(e.global);
    const sx = Math.floor(local.x / gridSize) * gridSize;
    const sy = Math.floor(local.y / gridSize) * gridSize;
    _cleanup();
    await _placeToken(actor, sx, sy);
    _advance();
  };

  _keyFn = (e) => {
    if (e.key === 'Escape') _cancel();
  };

  canvas.stage.on('pointermove', _moveFn);
  canvas.stage.on('pointerdown', _downFn);
  document.addEventListener('keydown', _keyFn);
}

async function _placeToken(actor, x, y) {
  const data = actor.prototypeToken.toObject();
  delete data._id;
  await canvas.scene.createEmbeddedDocuments('Token', [{ ...data, actorId: actor.id, x, y }]);
}

function _advance() {
  _placing = false;
  _queue.shift();
  if (_queue.length) {
    _startPlacement();
  } else {
    _targetSceneId = null;
  }
}

function _cancel() {
  _cleanup();
  _queue = [];
  _targetSceneId = null;
  _placing = false;
}

function _cleanup() {
  if (_ghost) {
    canvas.tokens?.removeChild(_ghost);
    _ghost.destroy();
    _ghost = null;
  }
  if (_hud) { _hud.remove(); _hud = null; }
  if (_moveFn) { canvas.stage?.off('pointermove', _moveFn); _moveFn = null; }
  if (_downFn) { canvas.stage?.off('pointerdown', _downFn); _downFn = null; }
  if (_keyFn) { document.removeEventListener('keydown', _keyFn); _keyFn = null; }
}

function _hudHTML(actor, remaining) {
  const img = actor.prototypeToken.texture.src;
  const name = actor.name;
  const hint = remaining > 1
    ? `${remaining} remaining · Click to place · Escape to cancel`
    : 'Last one · Click to place · Escape to cancel';
  return `<img src="${img}" alt="">
    <div class="sf-placer-hud__info">
      <strong class="sf-placer-hud__name">${name}</strong>
      <span class="sf-placer-hud__hint">${hint}</span>
    </div>`;
}
