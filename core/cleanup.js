export function initCleanupHooks() {
  if (!game.user.isGM) return;
  Hooks.on('deleteUser',  _onDeleteUser);
  Hooks.on('deleteActor', _onDeleteActor);
}

// Scan on scene activation — catches anything the hooks missed (GM was offline, etc.)
export async function cleanupStaleClaimsForScene(scene) {
  if (!game.user.isGM) return;
  const roster = scene.flags?.sceneforge?.roster ?? {};
  const claims = { ...(roster.claims ?? {}) };
  let dirty = false;

  for (const [actorId, claim] of Object.entries(claims)) {
    const userExists = !!game.users.get(claim.userId);
    const dupActor   = game.actors.get(claim.duplicateId);
    if (!userExists || !dupActor) {
      if (dupActor) {
        try { await dupActor.delete(); }
        catch (err) { console.error('SceneForge | cleanup: failed to delete duplicate actor:', err); }
      }
      delete claims[actorId];
      dirty = true;
    }
  }

  if (dirty) await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
}

async function _onDeleteUser(user) {
  if (game.user !== game.users.activeGM) return;
  for (const scene of game.scenes) {
    await _removeClaimsByUser(scene, user.id);
  }
}

async function _onDeleteActor(actor) {
  if (game.user !== game.users.activeGM) return;
  for (const scene of game.scenes) {
    await _removeClaimsByDuplicate(scene, actor.id);
  }
}

async function _removeClaimsByUser(scene, userId) {
  const roster = scene.flags?.sceneforge?.roster;
  if (!roster?.claims) return;
  const claims = { ...roster.claims };
  let dirty = false;

  for (const [actorId, claim] of Object.entries(claims)) {
    if (claim.userId !== userId) continue;
    const dup = game.actors.get(claim.duplicateId);
    if (dup) {
      try { await dup.delete(); }
      catch (err) { console.error('SceneForge | cleanup: failed to delete duplicate actor:', err); }
    }
    delete claims[actorId];
    dirty = true;
  }

  if (dirty) await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
}

async function _removeClaimsByDuplicate(scene, deletedActorId) {
  const roster = scene.flags?.sceneforge?.roster;
  if (!roster?.claims) return;
  const claims = { ...roster.claims };
  let dirty = false;

  for (const [actorId, claim] of Object.entries(claims)) {
    if (claim.duplicateId !== deletedActorId) continue;
    delete claims[actorId];
    dirty = true;
  }

  if (dirty) await scene.setFlag('sceneforge', 'roster', { ...roster, claims });
}
