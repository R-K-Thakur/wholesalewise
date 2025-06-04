
export const PRODUCT_CATEGORIES = [
  "Makeup",
  "Imitation Jewellery",
  "Sanitary items",
  "Hair Oils",
  "Utensils",
  "Skincare",
  "Haircare",
  "plastic",
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

// Moved from settings/page.tsx
export const DEFAULT_TREND_RANGE_STORAGE_KEY = "app-default-trend-range";
export const TREND_DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "180", label: "Last 180 Days" },
  { value: "365", label: "Last 365 Days" },
];

export const ITEMS_PER_PAGE_STORAGE_KEY = "app-items-per-page";
