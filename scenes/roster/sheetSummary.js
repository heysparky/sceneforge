// What the roster shows about a character, read live from the actor so it always
// matches the character sheet. Roll for Shoes gets its skills, inventory and statuses;
// other systems get class, biography and XP wherever they keep them.
// Which sections appear is a world setting (core/settings.js).

function plainText(html) {
  if (typeof html !== 'string' || !html) return '';
  // DOMParser gives inert text: nothing in the markup loads or runs.
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
}

// A field can be a string, a number, or an object such as { value } or a document with a name.
function asText(v) {
  if (typeof v === 'string') return plainText(v);
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object') return asText(v.name ?? v.label ?? v.value);
  return '';
}

// Foundry has no notion of class; systems call it class, concept, archetype…
// An explicit path from settings wins; otherwise try class items, then the usual fields.
function className(actor, path) {
  if (path) return asText(foundry.utils.getProperty(actor, path));
  const classItems = actor.items?.filter(i => i.type === 'class').map(i => i.name) ?? [];
  if (classItems.length) return classItems.join(' / ');
  const s = actor.system ?? {};
  return [s.class, s.details?.class, s.concept, s.details?.concept, s.archetype, s.details?.archetype]
    .map(asText).find(Boolean) ?? '';
}

function biography(system) {
  return [system.biography, system.details?.biography, system.description].map(asText).find(Boolean) ?? '';
}

function xp(system) {
  const raw = [system.xp, system.xp?.value, system.details?.xp?.value].find(v => typeof v === 'number');
  return raw ?? 0;
}

// Roll for Shoes skills are a flat list linked by parentId; flatten it depth-first.
function skillTree(skills) {
  if (!Array.isArray(skills)) return [];
  const out = [];
  const visit = (parentId, depth) => {
    for (const s of skills.filter(s => (s.parentId || '') === parentId)) {
      out.push({ name: s.name, level: s.level, depth });
      visit(s.id, depth + 1);
    }
  };
  visit('', 0);
  return out;
}

const names = list => (Array.isArray(list) ? list : [])
  .map(i => (typeof i === 'string' ? i : i?.quantity > 1 ? `${i.name} ×${i.quantity}` : i?.name))
  .filter(Boolean);

// shown: { Class, Xp, Biography, Skills, Carrying, Statuses } booleans; hidden sections come back empty.
export function sheetSummary(actor, shown, classPath = '') {
  const system = actor.system ?? {};
  const skills = shown.Skills ? skillTree(system.skills) : [];
  return {
    className: shown.Class     ? className(actor, classPath) : '',
    xp:        shown.Xp        ? xp(system)                  : 0,
    biography: shown.Biography ? biography(system)           : '',
    // Every new character starts with the same root skill; only show the tree once it grows.
    skills:    skills.length > 1 ? skills : [],
    carrying:  shown.Carrying  ? names(system.inventory).join(', ') : '',
    statuses:  shown.Statuses  ? names(system.statuses).join(', ')  : '',
  };
}
