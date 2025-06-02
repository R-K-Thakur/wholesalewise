
export const PRODUCT_CATEGORIES = [
  "Makeup",
  "Imitation Jewellery",
  "Sanitary Pads",
  "Hair Oils",
  "Kitchen Utensils",
  "Skincare",
  "Haircare",
  "Groceries",
  "Stationery",
  "Other",
] as const;

export const PRODUCT_UNITS = [
  "piece",
  "dozen",
  "gross",
  "pack",
  "box",
  "set",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const APP_NAME = "WholesaleWise";
