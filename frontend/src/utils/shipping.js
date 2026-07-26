export function parcelWeight(items = []) {
  return items.reduce(
    (total, item) => total + Number(item.weight_grams || 0) * Number(item.quantity || 0),
    0
  );
}

export function sriLankaPostFee(weightGrams) {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) return null;
  if (weightGrams <= 250) return 180;
  if (weightGrams <= 500) return 250;
  if (weightGrams <= 1000) return 350;
  if (weightGrams <= 2000) return 500;
  return null;
}

export function formatParcelWeight(weightGrams) {
  if (!weightGrams) return 'Not available';
  return weightGrams >= 1000
    ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 ? 2 : 0)} kg`
    : `${weightGrams} g`;
}
