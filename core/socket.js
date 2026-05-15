const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (game.user.isGM) _handleGM(msg).catch(err => console.error('SceneForge | socket error:', err));
    else _handlePlayer(msg);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function _handleGM({ action, sceneId, senderId, payload }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;
  if (action === 'roster.claim')   await _claim(scene, senderId, payload.actorId);
  if (action === 'roster.release') await _release(scene, senderId, payload.actorId);
}

function _handlePlayer({ action }) {
  if (action === 'roster.claim.rejected') {
    ui.notifications.warn('That character was just claimed by someone else.');
  }
}

async function _claim(scene, userId, actorId) {
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = roster.claims ?? {};

  if (claims[actorId]) {
    emit({ action: 'roster.claim.rejected', sceneId: scene.id,
           senderId: game.user.id, payload: { actorId, userId } });
    return;
  }

  if (Object.values(claims).some(c => c.userId === userId)) {
    emit({ action: 'roster.claim.rejected', sceneId: scene.id,
           senderId: game.user.id, payload: { actorId, userId } });
    return;
  }

  const original = game.actors.get(actorId);
  if (!original) return;

  const data = original.toObject();
  delete data._id;
  data.ownership = { default: 0, [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
  const duplicate = await Actor.create(data);

  const newClaims = { ...claims, [actorId]: { userId, duplicateId: duplicate.id } };
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims: newClaims });
}

async function _release(scene, userId, actorId) {
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  const claim  = claims[actorId];
  if (!claim || claim.userId !== userId) return;

  const duplicate = game.actors.get(claim.duplicateId);
  if (duplicate) {
    try { await duplicate.delete(); }
    catch (err) { console.error('SceneForge | Failed to delete duplicate actor:', err); }
  }

  delete claims[actorId];
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
}
