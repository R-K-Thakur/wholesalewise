
'use server';

import type { ValidatedProductFormData } from './schema';

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
