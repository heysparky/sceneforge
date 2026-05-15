const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (game.user.isGM) _handleGM(msg).catch(console.error);
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

  const userAlreadyClaims = Object.values(claims).some(c => c.userId === userId);
  if (userAlreadyClaims) {
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
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims: newClaims, _v: Date.now() });
}

async function _release(scene, userId, actorId) {
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  const claim  = claims[actorId];
  if (!claim || claim.userId !== userId) return;

  const duplicateId = claim.duplicateId;
  delete claims[actorId];
  // _v forces a detectable diff — Foundry's diffObject only walks the new
  // object's keys and misses deleted keys, so removing a claim produces an
  // empty diff and updateScene never fires without this counter.
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims, _v: Date.now() });

  const duplicate = game.actors.get(duplicateId);
  if (duplicate) {
    try { await duplicate.delete(); }
    catch (err) { console.error('SceneForge | Failed to delete duplicate actor:', err); }
  }
}

// Called directly on the GM client — bypasses the socket (GMs don't receive their own emits).
// No userId ownership check: GM can force-release any claim.
export async function gmRelease(sceneId, actorId) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  const claim  = claims[actorId];
  if (!claim) return;

  const duplicateId = claim.duplicateId;
  delete claims[actorId];
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims, _v: Date.now() });

  const duplicate = game.actors.get(duplicateId);
  if (duplicate) {
    try { await duplicate.delete(); }
    catch (err) { console.error('SceneForge | Failed to delete duplicate actor:', err); }
  }
}
