import { formatParcelWeight, parcelWeight, sriLankaPostFee } from './shipping';

describe('Sri Lanka Post shipping calculations', () => {
  test.each([
    [1, 180], [250, 180], [251, 250], [500, 250],
    [501, 350], [1000, 350], [1001, 500], [2000, 500],
  ])('charges the configured rate for %i grams', (weight, expected) => {
    expect(sriLankaPostFee(weight)).toBe(expected);
  });

  test('rejects unsupported weights', () => {
    expect(sriLankaPostFee(0)).toBeNull();
    expect(sriLankaPostFee(2001)).toBeNull();
  });

  test('calculates quantity-aware parcel weight', () => {
    expect(parcelWeight([
      { weight_grams: 120, quantity: 2 },
      { weight_grams: 80, quantity: 1 },
    ])).toBe(320);
  });

  test('formats grams and kilograms', () => {
    expect(formatParcelWeight(500)).toBe('500 g');
    expect(formatParcelWeight(1250)).toBe('1.25 kg');
  });
});
