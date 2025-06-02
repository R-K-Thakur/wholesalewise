
'use server';

import { z } from 'zod';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';
import type { ProductFormData } from '@/lib/types';

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

export async function addProduct(data: ValidatedProductFormData) {
  // In a real application, you would save this data to a database.
  // For now, we'll just log it to the server console.
  console.log('Adding new product (server action):', data);

  // Simulate database operation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example: Check if product name is "Fail" to simulate an error
  if (data.productName.toLowerCase() === 'fail') {
    return { success: false, message: 'Simulated error: Product name cannot be "Fail".' };
  }

  // Return a success response
  return { success: true, message: 'Product added successfully!', product: data };
}
