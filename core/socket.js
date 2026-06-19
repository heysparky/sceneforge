const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (!game.user.isGM) return;
    _handleGM(msg).catch(console.error);
  });

  Hooks.on('deleteActor', async (actor) => {
    if (!game.user.isGM) return;
    if (!actor.getFlag('sceneforge', 'isClone')) return;
    for (const scene of game.scenes) {
      const claims = scene.flags?.sceneforge?.roster?.claims ?? {};
      for (const [templateId, claim] of Object.entries(claims)) {
        if (claim?.cloneId === actor.id && claim?.claimedBy) {
          await applyRelease(templateId, claim.claimedBy, scene.id);
          return;
        }
      }
    }
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function _handleGM({ action, actorId, userId, sceneId }) {
  if (action === 'claim')   await applyClaim(actorId, userId, sceneId);
  if (action === 'release') await applyRelease(actorId, userId, sceneId);
}

export async function applyClaim(actorId, userId, sceneId) {
  const template = game.actors.get(actorId);
  if (!template) return;
  if (template.getFlag('sceneforge', 'locked')) return;

  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const claims = scene.flags?.sceneforge?.roster?.claims ?? {};
  if (claims[actorId]?.claimedBy) return;

  // One-per-player: release any character this user already holds in this scene
  for (const [templateId, claim] of Object.entries(claims)) {
    if (claim?.claimedBy === userId) {
      await applyRelease(templateId, userId, sceneId);
    }
  }

  // Clone the template, owned by the claiming player
  const data = template.toObject();
  delete data._id;
  data.flags = data.flags ?? {};
  data.flags.sceneforge = data.flags.sceneforge ?? {};
  data.flags.sceneforge.isClone = true;
  delete data.flags.sceneforge.dossier;
  const claimer = game.users.get(userId);
  data.ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  };

  const destFolder = scene.flags?.sceneforge?.roster?.destFolder ?? null;
  if (destFolder) data.folder = destFolder;

  const clone = await Actor.create(data);
  if (!clone) return;

  const ringColor = template.prototypeToken?.ring?.colors?.ring ?? null;
  const userUpdates = { character: clone.id };
  if (ringColor) userUpdates.color = ringColor;

  await Promise.all([
    scene.update({ [`flags.sceneforge.roster.claims.${actorId}`]: { claimedBy: userId, cloneId: clone.id } }),
    claimer ? claimer.update(userUpdates) : Promise.resolve(),
  ]);

  const updatedClaims = scene.flags?.sceneforge?.roster?.claims ?? {};
  const claimedUserIds = new Set(Object.values(updatedClaims).map(c => c?.claimedBy).filter(Boolean));
  const activePlayers = game.users.filter(u => u.active && !u.isGM);
  const remaining = activePlayers.filter(u => !claimedUserIds.has(u.id)).length;
  ui.notifications.info(
    `${claimer?.name ?? 'Player'} selected ${template.name}. ${remaining} player(s) still need to claim a character.`
  );
}

export async function applyRelease(actorId, userId, sceneId) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const claims = scene.flags?.sceneforge?.roster?.claims ?? {};
  const claim = claims[actorId];
  if (!claim || claim.claimedBy !== userId) return;

  const cloneId = claim.cloneId;
  if (cloneId) await game.actors.get(cloneId)?.delete();

  await Promise.all([
    scene.update({ [`flags.sceneforge.roster.claims.${actorId}`]: { claimedBy: null, cloneId: null } }),
    game.users.get(userId)?.update({ character: null }),
  ]);
}
