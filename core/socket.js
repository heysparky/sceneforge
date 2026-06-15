const CHANNEL = 'module.sceneforge';

export function initSocket() {
  console.log('[SF initSocket] registering listener on', CHANNEL);
  game.socket.on(CHANNEL, msg => {
    console.log('[SF socket] received', msg, 'isGM:', game.user.isGM);
    if (!game.user.isGM) return;
    _handleGM(msg).catch(console.error);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function _handleGM({ action, actorId, userId, sceneId }) {
  console.log('[SF _handleGM]', action, actorId, userId);
  if (action === 'claim')   await applyClaim(actorId, userId, sceneId);
  if (action === 'release') await applyRelease(actorId, userId);
}

export async function applyClaim(actorId, userId, sceneId) {
  console.log('[SF applyClaim] start', actorId, userId);
  const template = game.actors.get(actorId);
  if (!template) { console.log('[SF applyClaim] no template'); return; }
  if (template.getFlag('sceneforge', 'locked')) { console.log('[SF applyClaim] locked'); return; }
  if (template.getFlag('sceneforge', 'claimedBy')) { console.log('[SF applyClaim] already claimed'); return; }

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
  data.ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  };

  const scene = game.scenes.get(sceneId);
  const destFolder = scene?.flags?.sceneforge?.roster?.destFolder ?? null;
  if (destFolder) data.folder = destFolder;

  console.log('[SF applyClaim] creating clone for', userId);
  const clone = await Actor.create(data);
  console.log('[SF applyClaim] clone result:', clone?.name ?? 'NULL');
  if (!clone) return;

  await template.update({
    'flags.sceneforge.claimedBy': userId,
    'flags.sceneforge.cloneId':   clone.id,
  });

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

  await template.update({
    'flags.sceneforge.claimedBy': null,
    'flags.sceneforge.cloneId':   null,
  });
}
