const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (!game.user.isGM) return;
    _handleGM(msg).catch(console.error);
  });

  Hooks.on('deleteActor', async (actor) => {
    if (!game.user.isGM) return;
    if (!actor.getFlag('sceneforge', 'isClone')) return;
    const template = game.actors.find(a => a.getFlag('sceneforge', 'cloneId') === actor.id);
    if (!template) return;
    const claimedBy = template.getFlag('sceneforge', 'claimedBy');
    if (!claimedBy) return;
    await applyRelease(template.id, claimedBy);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function _handleGM({ action, actorId, userId, sceneId }) {
  if (action === 'claim')   await applyClaim(actorId, userId, sceneId);
  if (action === 'release') await applyRelease(actorId, userId);
}

export async function applyClaim(actorId, userId, sceneId) {
  const template = game.actors.get(actorId);
  if (!template) return;
  if (template.getFlag('sceneforge', 'locked')) return;
  if (template.getFlag('sceneforge', 'claimedBy')) return;

  // One-per-player: release any character this user already holds
  for (const actor of game.actors) {
    if (actor.getFlag('sceneforge', 'claimedBy') === userId) {
      await applyRelease(actor.id, userId);
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

  const scene = game.scenes.get(sceneId);
  const destFolder = scene?.flags?.sceneforge?.roster?.destFolder ?? null;
  if (destFolder) data.folder = destFolder;

  const clone = await Actor.create(data);
  if (!clone) return;

  const ringColor = template.prototypeToken?.ring?.colors?.ring ?? null;
  const userUpdates = { character: clone.id };
  if (ringColor) userUpdates.color = ringColor;

  await Promise.all([
    template.update({
      'flags.sceneforge.claimedBy': userId,
      'flags.sceneforge.cloneId':   clone.id,
    }),
    claimer ? claimer.update(userUpdates) : Promise.resolve(),
  ]);

  // Notify the GM how many players are still waiting
  const claimedUserIds = new Set(
    game.actors.map(a => a.getFlag('sceneforge', 'claimedBy')).filter(Boolean)
  );
  const activePlayers = game.users.filter(u => u.active && !u.isGM);
  const remaining = activePlayers.filter(u => !claimedUserIds.has(u.id)).length;
  ui.notifications.info(
    `${claimer?.name ?? 'Player'} selected ${template.name}. ${remaining} player(s) still need to claim a character.`
  );
}

export async function applyRelease(actorId, userId) {
  const template = game.actors.get(actorId);
  if (!template) return;
  if (template.getFlag('sceneforge', 'claimedBy') !== userId) return;

  const cloneId = template.getFlag('sceneforge', 'cloneId');
  if (cloneId) await game.actors.get(cloneId)?.delete();

  await Promise.all([
    template.update({
      'flags.sceneforge.claimedBy': null,
      'flags.sceneforge.cloneId':   null,
    }),
    game.users.get(userId)?.update({ character: null }),
  ]);
}
