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
  console.log('SF | _handleGM received:', action, { sceneId, senderId, payload });
  const scene = game.scenes.get(sceneId);
  if (!scene) { console.warn('SF | _handleGM: scene not found', sceneId); return; }
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
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims: newClaims });
}

async function _release(scene, userId, actorId) {
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  const claim  = claims[actorId];
  console.log('SF | _release:', { actorId, userId, claim: JSON.stringify(claim) });
  if (!claim) { console.warn('SF | _release: no claim found for', actorId); return; }
  if (claim.userId !== userId) {
    console.warn('SF | _release: userId mismatch — claim.userId:', claim.userId, 'senderId:', userId);
    return;
  }

  const duplicateId = claim.duplicateId;
  delete claims[actorId];
  console.log('SF | _release: calling setFlag');
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
  console.log('SF | _release: setFlag complete');

  const duplicate = game.actors.get(duplicateId);
  if (duplicate) {
    try { await duplicate.delete(); }
    catch (err) { console.error('SceneForge | Failed to delete duplicate actor:', err); }
  }
}

// Called directly on the GM client — bypasses the socket (GMs don't receive their own emits).
// No userId ownership check: GM can force-release any claim.
export async function gmRelease(sceneId, actorId) {
  console.log('SF | gmRelease called:', { sceneId, actorId });
  const scene = game.scenes.get(sceneId);
  if (!scene) { console.warn('SF | gmRelease: scene not found', sceneId); return; }
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  const claim  = claims[actorId];
  console.log('SF | gmRelease: claim=', JSON.stringify(claim), 'claims keys=', Object.keys(claims));
  if (!claim) { console.warn('SF | gmRelease: no claim found for actorId:', actorId); return; }

  const duplicateId = claim.duplicateId;
  delete claims[actorId];
  console.log('SF | gmRelease: calling setFlag');
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
  console.log('SF | gmRelease: setFlag complete');

  const duplicate = game.actors.get(duplicateId);
  if (duplicate) {
    try { await duplicate.delete(); }
    catch (err) { console.error('SceneForge | Failed to delete duplicate actor:', err); }
  }
}
