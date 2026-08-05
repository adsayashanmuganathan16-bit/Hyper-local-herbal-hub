const KEY = 'herbal_hub_wishlist';

async function persist(id, wished) {
  if (!localStorage.getItem('herbal_hub_token')) return;
  const { wishlistApi } = await import('../api/wishlistApi');
  if (wished) await wishlistApi.add(id);
  else await wishlistApi.remove(id);
}

export function wishlistIds() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function isWishlisted(id) {
  return wishlistIds().includes(String(id));
}

export function toggleWishlist(id) {
  const value = String(id);
  const current = wishlistIds();
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('herbal:wishlist', { detail: next }));
  persist(value, next.includes(value)).catch(() => {});
  return next.includes(value);
}

export function replaceWishlist(ids, notify = true) {
  const next = [...new Set(ids.map(String))];
  localStorage.setItem(KEY, JSON.stringify(next));
  if (notify) window.dispatchEvent(new CustomEvent('herbal:wishlist', { detail: next }));
  return next;
}
