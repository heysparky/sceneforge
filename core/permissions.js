const { OWNER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

export async function claimActor(actor, claimingUserId, otherLevel) {
  const ownership = foundry.utils.deepClone(actor.ownership);
  for (const user of game.users) {
    if (user.isGM) continue;
    ownership[user.id] = user.id === claimingUserId ? OWNER : otherLevel;
  }
  await actor.update({ ownership });
}

export async function releaseActor(actor, releasedUserId, otherLevel) {
  const ownership = foundry.utils.deepClone(actor.ownership);
  if (!game.users.get(releasedUserId)?.isGM) {
    ownership[releasedUserId] = otherLevel;
  }
  await actor.update({ ownership });
}

export async function reassignActor(actor, fromUserId, toUserId, otherLevel) {
  const ownership = foundry.utils.deepClone(actor.ownership);
  if (!game.users.get(fromUserId)?.isGM) ownership[fromUserId] = otherLevel;
  if (!game.users.get(toUserId)?.isGM) ownership[toUserId] = OWNER;
  await actor.update({ ownership });
}
