
import { z } from 'zod';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';

export const productFormSchema = z.object({
  productName: z.string().min(1, { message: 'Product name is required.' }).max(100),
  category: z.enum(PRODUCT_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category.' }),
  }),
  purchasePrice: z.coerce
    .number({ invalid_type_error: 'Purchase price must be a number.' })
    .positive({ message: 'Purchase price must be positive.' }),
  retailPrice: z.coerce
    .number({ invalid_type_error: 'Retail price must be a number.' })
    .positive({ message: 'Retail price must be positive.' }),
  wholesalePrice: z.coerce
    .number({ invalid_type_error: 'Wholesale price must be a number.' })
    .positive({ message: 'Wholesale price must be positive.' }),
  unit: z.enum(PRODUCT_UNITS, {
    errorMap: () => ({ message: 'Please select a valid unit.' }),
  }),
  initialStock: z.coerce
    .number({ invalid_type_error: 'Initial stock must be a number.' })
    .int({ message: 'Initial stock must be a whole number.' })
    .nonnegative({ message: 'Initial stock cannot be negative.' }),
});

export type ValidatedProductFormData = z.infer<typeof productFormSchema>;
