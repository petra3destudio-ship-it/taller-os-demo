// La exportación pública usa memoria; el workspace conserva la demo local existente.
(() => {
  const memory = new Map();
  const volatile = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key),
  };
  if (window.TALLER_CONFIG?.publicDemo) { window.TALLER_STORAGE = volatile; return; }
  try { window.TALLER_STORAGE = window.localStorage; }
  catch { window.TALLER_STORAGE = volatile; }
})();
