export const PRODUCT_IMAGE_PLACEHOLDER =
  `${process.env.PUBLIC_URL || ''}/product-placeholder.svg`;

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  .replace(/\/$/, '');

export function productImageUrl(source) {
  const candidate = typeof source === 'string'
    ? source
    : source?.images?.find(Boolean)
      || source?.image
      || source?.image_url
      || source?.imageUrl;

  if (!candidate || typeof candidate !== 'string') {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }

  const value = candidate.trim();
  if (!value) return PRODUCT_IMAGE_PLACEHOLDER;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  if (value.startsWith('uploads/')) return `${API_BASE_URL}/${value}`;
  return PRODUCT_IMAGE_PLACEHOLDER;
}

export function useProductImageFallback(event) {
  const image = event.currentTarget;
  if (image.src.endsWith(PRODUCT_IMAGE_PLACEHOLDER)) return;
  image.onerror = null;
  image.src = PRODUCT_IMAGE_PLACEHOLDER;
}
