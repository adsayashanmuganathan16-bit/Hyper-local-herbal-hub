import {
  PRODUCT_IMAGE_PLACEHOLDER,
  productImageUrl,
} from './productImage';

describe('productImageUrl', () => {
  test('supports current and legacy product image fields', () => {
    expect(productImageUrl({ images: ['https://example.com/current.jpg'] }))
      .toBe('https://example.com/current.jpg');
    expect(productImageUrl({ image: 'https://example.com/image.jpg' }))
      .toBe('https://example.com/image.jpg');
    expect(productImageUrl({ image_url: 'https://example.com/snake.jpg' }))
      .toBe('https://example.com/snake.jpg');
    expect(productImageUrl({ imageUrl: 'https://example.com/camel.jpg' }))
      .toBe('https://example.com/camel.jpg');
  });

  test('resolves backend-relative uploads', () => {
    expect(productImageUrl('/uploads/products/item.jpg'))
      .toBe('http://localhost:8000/uploads/products/item.jpg');
    expect(productImageUrl('uploads/products/item.jpg'))
      .toBe('http://localhost:8000/uploads/products/item.jpg');
  });

  test('uses the local placeholder for missing or invalid paths', () => {
    expect(productImageUrl({})).toBe(PRODUCT_IMAGE_PLACEHOLDER);
    expect(productImageUrl('not-a-valid-image-path')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  });
});
