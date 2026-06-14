const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (!game.user.isGM) return;
    _handleGM(msg).catch(console.error);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function _handleGM({ action, actorId, userId }) {
  if (action === 'claim')   await applyClaim(actorId, userId);
  if (action === 'release') await applyRelease(actorId, userId);
}

export async function applyClaim(actorId, userId) {
  const template = game.actors.get(actorId);
  if (!template) return;
  if (template.getFlag('sceneforge', 'locked')) return;
  if (template.getFlag('sceneforge', 'claimedBy')) return; // race guard

  // One-per-player: release any character this user already holds
  for (const actor of game.actors) {
    if (actor.getFlag('sceneforge', 'claimedBy') === userId) {
      await applyRelease(actor.id, userId);
    }
  }

  // Clone the template, owned by the claiming player
  const data = template.toObject();
  delete data._id;
  const claimer = game.users.get(userId);
  data.name = `${data.name} (${claimer?.name ?? 'Player'})`;
  data.ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  };

  const clone = await Actor.create(data);
  if (!clone) return;

  await template.setFlag('sceneforge', 'claimedBy', userId);
  await template.setFlag('sceneforge', 'cloneId', clone.id);

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

  await template.unsetFlag('sceneforge', 'claimedBy');
  await template.unsetFlag('sceneforge', 'cloneId');
}
