export type StockStatus = 'HEALTHY' | 'LOW' | 'CRITICAL' | 'EMPTY';

/** EMPTY = 0, CRITICAL <= half the threshold, LOW <= threshold, else HEALTHY. */
export function stockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return 'EMPTY';
  if (quantity <= lowStockThreshold / 2) return 'CRITICAL';
  if (quantity <= lowStockThreshold) return 'LOW';
  return 'HEALTHY';
}
