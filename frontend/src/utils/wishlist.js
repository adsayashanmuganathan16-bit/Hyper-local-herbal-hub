const KEY = 'herbal_hub_wishlist';
export const MAX_WISHLIST_ITEMS = 5;

async function persistWishlist(api, value, wished) {
  const request = () => wished ? api.add(value) : api.remove(value);
  try {
    await request();
  } catch (error) {
    if (error.response) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    await request();
  }
}

export function wishlistIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(stored) ? [...new Set(stored.map(String))] : [];
  } catch {
    return [];
  }
}

export function isWishlisted(id) {
  return wishlistIds().includes(String(id));
}

export async function toggleWishlist(id) {
  const value = String(id);
  const current = wishlistIds();
  const wished = !current.includes(value);

  if (wished && current.length >= MAX_WISHLIST_ITEMS) {
    throw new Error(`You can save up to ${MAX_WISHLIST_ITEMS} products in your wishlist.`);
  }

  if (localStorage.getItem('herbal_hub_token')) {
    const { wishlistApi } = await import('../api/wishlistApi');
    await persistWishlist(wishlistApi, value, wished);
  }

  const next = wished ? [...current, value] : current.filter((item) => item !== value);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('herbal:wishlist', { detail: next }));
  window.dispatchEvent(new CustomEvent('herbal:wishlist-synced', {
    detail: { id: value, wished },
  }));
  return wished;
}

export function replaceWishlist(ids, notify = true) {
  const next = [...new Set(ids.map(String))].slice(0, MAX_WISHLIST_ITEMS);
  localStorage.setItem(KEY, JSON.stringify(next));
  if (notify) window.dispatchEvent(new CustomEvent('herbal:wishlist', { detail: next }));
  return next;
}
