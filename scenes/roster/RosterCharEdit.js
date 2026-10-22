const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Biographies are often stored as HTML; DOMParser gives inert text without loading anything.
function plainText(html) {
  if (typeof html !== 'string' || !html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
}

// Systems keep these in different places; take the first one that looks right.
export function sheetBiography(actor) {
  const s = actor.system ?? {};
  const raw = [s.biography, s.biography?.value, s.details?.biography?.value, s.details?.biography, s.description]
    .find(v => typeof v === 'string' && v.trim());
  return plainText(raw);
}

function sheetXp(actor) {
  const s = actor.system ?? {};
  const raw = [s.xp, s.xp?.value, s.details?.xp?.value].find(v => typeof v === 'number');
  return raw === undefined ? '' : String(raw);
}

class DossierEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['sceneforge-dossier-editor'],
    window: { icon: 'fas fa-feather', resizable: false },
    position: { width: 760 },
    form: {
      handler: DossierEditor.#onSubmit,
      closeOnSubmit: true,
    },
    actions: {
      fillFromSheet: DossierEditor.#onFillFromSheet,
      cancel:        DossierEditor.#onCancel,
    },
  };

  static PARTS = {
    main: { template: 'modules/sceneforge/scenes/roster/dossierEdit.html' },
  };

  #actor;
  #scene;

  constructor(actor, scene, options = {}) {
    super({ ...options, id: `sceneforge-dossier-${scene.id}-${actor.id}` });
    this.#actor = actor;
    this.#scene = scene;
  }

  get title() {
    return game.i18n.format('SCENEFORGE.Dossier.Title', { name: this.#actor.name });
  }

  async _prepareContext(_options) {
    const actor = this.#actor;
    const d = this.#scene.flags?.sceneforge?.roster?.dossiers?.[actor.id] ?? {};
    // Older dossiers kept a separate "show" toggle per field; a hidden field opens empty.
    const field = (key, def = false) => (d[`show${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? def) ? (d[key] ?? '') : '';

    return {
      name:       actor.name,
      img:        actor.img,
      ringColor:  actor.prototypeToken?.ring?.colors?.ring ?? null,
      theme:      this.#scene.flags?.sceneforge?.theme ?? 'default',
      concept:    field('concept'),
      level:      field('level'),
      xp:         field('xp', true),
      quote:      field('quote'),
      background: d.showBackground ? (d.background || sheetBiography(actor)) : '',
      custom:     d.custom ?? '',
      canFill:    !!(sheetBiography(actor) || sheetXp(actor)),
    };
  }

  _onFirstRender(_context, _options) {
    this.element.addEventListener('input', () => this.#updatePreview());
  }

  _onRender(_context, _options) {
    this.#updatePreview();
  }

  #value(name) {
    return this.element.querySelector(`[name="${name}"]`)?.value.trim() ?? '';
  }

  #updatePreview() {
    const i18n = game.i18n;
    const level = this.#value('level');
    const xp    = this.#value('xp');
    const text = {
      epithet: [
        this.#value('concept'),
        level ? i18n.format('SCENEFORGE.Roster.Level', { level }) : '',
        xp    ? i18n.format('SCENEFORGE.Roster.Xp',    { xp })    : '',
      ].filter(Boolean).join(' · '),
      quote:      this.#value('quote'),
      background: this.#value('background'),
      custom:     this.#value('custom'),
    };
    for (const [key, value] of Object.entries(text)) {
      const el = this.element.querySelector(`[data-preview="${key}"]`);
      if (!el) continue;
      el.textContent = value;
      el.hidden = !value;
    }
  }

  static #onFillFromSheet() {
    const bio = sheetBiography(this.#actor);
    const xp  = sheetXp(this.#actor);
    if (bio) this.element.querySelector('[name="background"]').value = bio;
    if (xp)  this.element.querySelector('[name="xp"]').value = xp;
    this.#updatePreview();
  }

  static #onCancel() {
    this.close();
  }

  // Empty means hidden; the show* flags are kept so the stored shape doesn't change.
  static async #onSubmit(_event, _form, formData) {
    const f = formData.object;
    const v = key => String(f[key] ?? '').trim();
    const data = {
      showConcept:    !!v('concept'),    concept:    v('concept'),
      showLevel:      !!v('level'),      level:      v('level'),
      showXp:         !!v('xp'),         xp:         v('xp'),
      showBackground: !!v('background'), background: v('background'),
      showQuote:      !!v('quote'),      quote:      v('quote'),
      custom:         v('custom'),
    };
    await this.#scene.update({ [`flags.sceneforge.roster.dossiers.${this.#actor.id}`]: data });
  }
}

export async function editCharacterDossier(actor, scene) {
  const existing = foundry.applications.instances.get(`sceneforge-dossier-${scene.id}-${actor.id}`);
  if (existing) return existing.render({ force: true });
  return new DossierEditor(actor, scene).render({ force: true });
}
