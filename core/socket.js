const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (game.user.isGM) handleGM(msg).catch(console.error);
    else handlePlayer(msg);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function handleGM({ action, sceneId, senderId, payload }) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  if (action === 'sceneforge.roster.claim') {
    await _rosterClaim(scene, senderId, payload);
  } else if (action === 'sceneforge.roster.release') {
    await _rosterRelease(scene, senderId, payload);
  }
}

function handlePlayer(_msg) {
  // GM broadcasts are handled via updateScene hook — no explicit player handler needed yet
}

async function _rosterClaim(scene, userId, { actorId }) {
  const roster = scene.flags?.sceneforge?.roster;
  if (!roster) return;

  const templates = roster.templates ?? [];
  const claims = roster.claims ?? {};

  if (!templates.includes(actorId)) return;
  if (claims[actorId]) return; // already claimed
  if (Object.values(claims).some(c => c?.userId === userId)) return; // player already has a claim

  const template = game.actors.get(actorId);
  if (!template) return;

  const data = template.toObject();
  delete data._id;
  data.ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  };
  const claimerName = game.users.get(userId)?.name ?? 'Player';
  data.name = `${data.name} (${claimerName})`;

  const clone = await Actor.create(data);
  if (!clone) return;

  const newClaims = { ...claims, [actorId]: { userId, cloneId: clone.id } };
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims: newClaims });
  Hooks.callAll('sceneforge:dataChanged', scene.id);
}

async function _rosterRelease(scene, userId, { actorId }) {
  const roster = scene.flags?.sceneforge?.roster;
  if (!roster) return;

  const claim = roster.claims?.[actorId] ?? null;
  if (!claim || claim.userId !== userId) return; // not their claim

  if (claim.cloneId) await game.actors.get(claim.cloneId)?.delete();

  const newClaims = { ...roster.claims, [actorId]: null };
  await scene.setFlag('sceneforge', 'roster', { ...roster, claims: newClaims });
  Hooks.callAll('sceneforge:dataChanged', scene.id);
}
