
import { z } from 'zod';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';

export const productFormSchema = z.object({
  productName: z.string().min(1, { message: 'Product name is required.' }).max(100),
  category: z.enum(PRODUCT_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category.' }),
  }),
  baseUnit: z.enum(PRODUCT_UNITS, {
    errorMap: () => ({ message: 'Please select a valid base unit.' }),
  }),
  purchaseUnit: z.enum(PRODUCT_UNITS, {
    errorMap: () => ({ message: 'Please select a valid purchase unit.' }),
  }),
  purchaseUnitConversionFactor: z.coerce
    .number({ invalid_type_error: 'Conversion factor must be a number.' })
    .min(1, { message: 'Conversion factor must be at least 1.' })
    .optional(),
  purchasePrice: z.coerce // For full product forms, owner must set a positive price. Staff quick-add sets to 0.
    .number({ invalid_type_error: 'Purchase price must be a number.' })
    .nonnegative({ message: 'Purchase price (per purchase unit) cannot be negative.' }), // Allows 0 for staff init
  retailPricePerBaseUnit: z.coerce
    .number({ invalid_type_error: 'Retail price must be a number.' })
    .positive({ message: 'Retail price (per base unit) must be positive.' }),
  wholesalePricePerBaseUnit: z.coerce
    .number({ invalid_type_error: 'Wholesale price must be a number.' })
    .positive({ message: 'Wholesale price (per base unit) must be positive.' }),
  initialStock: z.coerce
    .number({ invalid_type_error: 'Stock quantity must be a number.' })
    .int({ message: 'Stock quantity must be a whole number.' })
    .nonnegative({ message: 'Stock quantity cannot be negative.' }),
  reorderThreshold: z.coerce
    .number({ invalid_type_error: 'Reorder threshold must be a number.' })
    .int({ message: 'Reorder threshold must be a whole number.' })
    .nonnegative({ message: 'Reorder threshold cannot be negative.' })
    .optional(),
}).superRefine((data, ctx) => {
  if (data.baseUnit !== data.purchaseUnit && (data.purchaseUnitConversionFactor === undefined || data.purchaseUnitConversionFactor < 1)) {
    // This check is primarily for the main product forms. Quick Add form has its own logic.
    if (!(data.purchaseUnit === "dozen" && data.baseUnit === "piece")) { // Auto-handled case
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Conversion factor is required and must be at least 1 when purchase unit differs from base unit.",
            path: ["purchaseUnitConversionFactor"],
        });
    }
  }
  // For the main product form (not quick-add): ensure purchase price is positive if user isn't staff (handled by UI for staff)
  // This schema is also used by quick-add, where staff can submit 0 for purchase price.
  // If we want to enforce positive for owners directly in schema, role check here would be complex.
  // It's better handled in the action or UI for the specific forms.
  // The .nonnegative() on purchasePrice allows 0.
});

export type ValidatedProductFormData = z.infer<typeof productFormSchema>;
