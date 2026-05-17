// Map of type key → { factory, label, icon, available }
const _types = new Map();

export function registerType(key, factory, { label = key, icon = 'fa-circle', available = true } = {}) {
  _types.set(key, { factory, label, icon, available });
}

export function getAll() {
  return Array.from(_types.entries()).map(([key, desc]) => ({ key, ...desc }));
}

export async function loadType(key) {
  const entry = _types.get(key);
  if (!entry) return null;
  const mod = await entry.factory();
  return mod.default ?? Object.values(mod)[0];
}
