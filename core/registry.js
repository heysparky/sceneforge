const registry = new Map();

export const registerSceneType = (id, loader) => registry.set(id, loader);

export const loadSceneType = (id) => {
  if (!registry.has(id)) return null;
  return registry.get(id)();
};
