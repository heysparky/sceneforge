/**
 * Opens a modal actor picker and returns the selected actor IDs.
 * @param {string[]} excludeIds - Actor IDs already on the roster (will not appear in the list).
 * @returns {Promise<string[]>} Selected actor IDs, or [] if the GM cancelled/skipped.
 */
export async function pickRosterTemplates(excludeIds = [], folderId = null) {
  const { DialogV2 } = foundry.applications.api;
  const excluded = new Set(excludeIds);
  let actors = game.actors.filter(a => !excluded.has(a.id) && !a.getFlag('sceneforge', 'isClone'));
  if (folderId) actors = actors.filter(a => a.folder?.id === folderId);
  actors = actors.sort((a, b) => a.name.localeCompare(b.name));

  if (!actors.length) {
    ui.notifications.info('No actors available to add to the roster.');
    return [];
  }

  const rows = actors.map(a => `
    <label class="sf-actor-pick-row">
      <input type="checkbox" name="actorId" value="${a.id}">
      <img src="${a.img}" alt="" width="36" height="36">
      <span>${a.name}</span>
    </label>
  `).join('');

  const content = `
    <div class="sf-actor-picker">
      <p>Select actors to add to this roster:</p>
      <div class="sf-actor-pick-list">${rows}</div>
    </div>
  `;

  const result = await DialogV2.wait({
    window: { title: 'Configure Roster' },
    position: { width: 600 },
    content,
    buttons: [
      {
        action: 'add',
        label: 'Add to Roster',
        default: true,
        callback: (_e, _b, dialog) => {
          const checked = [...dialog.element.querySelectorAll('input[name="actorId"]:checked')];
          return checked.map(el => el.value);
        },
      },
      { action: 'skip', label: 'Skip', callback: () => [] },
    ],
    rejectClose: false,
  });

  return result ?? [];
}
