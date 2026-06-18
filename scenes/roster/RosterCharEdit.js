export async function editCharacterDossier(actor, scene) {
  const { DialogV2 } = foundry.applications.api;
  const d = scene?.flags?.sceneforge?.roster?.dossiers?.[actor.id] ?? {};

  const val   = (key, fallback = '') => d[key] !== undefined ? d[key] : fallback;
  const chk   = (key, def = false)  => (d[key] !== undefined ? d[key] : def) ? 'checked' : '';
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1);

  const row = (key, label, type = 'text', fallback = '', defShow = false) => {
    const showKey = `show${cap(key)}`;
    const input = type === 'textarea'
      ? `<textarea class="sf-dossier-edit__input" name="${key}" rows="2">${val(key, fallback)}</textarea>`
      : `<input class="sf-dossier-edit__input" type="${type}" name="${key}" value="${val(key, fallback)}">`;
    return `<div class="sf-dossier-edit__row">
      <label class="sf-dossier-edit__check">
        <input type="checkbox" name="${showKey}" ${chk(showKey, defShow)}> ${label}
      </label>
      ${input}
    </div>`;
  };

  const content = `<div class="sf-dossier-edit">
    ${row('concept',    'Concept',    'text',     '')}
    ${row('level',      'Level',      'text',     '')}
    ${row('xp',         'XP',         'number',   String(actor.system?.xp ?? ''), true)}
    ${row('background', 'Background', 'textarea', actor.system?.biography ?? '')}
    ${row('quote',      'Quote',      'textarea', '')}
    <div class="sf-dossier-edit__row sf-dossier-edit__row--custom">
      <label class="sf-dossier-edit__label">Custom text</label>
      <textarea class="sf-dossier-edit__input" name="custom" rows="3">${val('custom')}</textarea>
    </div>
  </div>`;

  const get     = (el, name) => el.querySelector(`[name="${name}"]`);
  const checked = (el, name) => get(el, name)?.checked ?? false;
  const value   = (el, name) => get(el, name)?.value?.trim() ?? '';

  const result = await DialogV2.wait({
    window: { title: `Dossier — ${actor.name}` },
    position: { width: 420 },
    content,
    buttons: [
      {
        action: 'save',
        label: 'Save',
        default: true,
        callback: (_e, _b, dialog) => {
          const el = dialog.element;
          return {
            showConcept:    checked(el, 'showConcept'),
            concept:        value(el, 'concept'),
            showLevel:      checked(el, 'showLevel'),
            level:          value(el, 'level'),
            showXp:         checked(el, 'showXp'),
            xp:             value(el, 'xp'),
            showBackground: checked(el, 'showBackground'),
            background:     value(el, 'background'),
            showQuote:      checked(el, 'showQuote'),
            quote:          value(el, 'quote'),
            custom:         value(el, 'custom'),
          };
        },
      },
      { action: 'cancel', label: 'Cancel', callback: () => null },
    ],
    rejectClose: false,
  });

  if (!result || typeof result !== 'object') return;
  await scene.update({ ['flags.sceneforge.roster.dossiers.' + actor.id]: result });
}
