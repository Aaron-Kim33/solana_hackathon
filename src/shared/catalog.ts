// Public preview only. Prices and entitlements must come from the server.
export const PRODUCT_CATALOG = [
  { id: 'second-forest-growth-v1', status: 'preview', limitPerAccount: 1, gems: { medium: 10, high: 1 } },
  { id: 'deepwood-enhancement-v1', status: 'preview', limitPerAccount: 1, gems: { medium: 0, high: 5 } },
] as const;
export type ProductId = typeof PRODUCT_CATALOG[number]['id'];
export type PaymentCurrency = 'SOL' | 'SKR';
