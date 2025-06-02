
'use server';

import { revalidatePath } from 'next/cache';
import { addProductToStore, getAllProducts as getAllProductsFromStore, deleteProductFromStore as deleteProductFromStoreInternal, findProductById as findProductByIdFromStore, updateProductInStore as updateProductInStoreInternal } from '@/lib/mockStore';
import type { ValidatedProductFormData } from './schema';
import type { Product } from '@/lib/types';


export async function addProduct(data: ValidatedProductFormData) {
  console.log('Adding new product (server action):', data);

  // Example: Check if product name is "Fail" to simulate an error
  if (data.productName.toLowerCase() === 'fail') {
    return { success: false, message: 'Simulated error: Product name cannot be "Fail".' };
  }

  const newProduct = await addProductToStore(data);
  revalidatePath('/products'); // Revalidate the products page to show the new product
  revalidatePath('/dashboard'); // Also revalidate dashboard if it shows product counts

  return { success: true, message: 'Product added successfully!', product: newProduct };
}

export async function getProductsAction(): Promise<Product[]> {
  return await getAllProductsFromStore();
}

export async function getProductByIdAction(id: string): Promise<Product | undefined> {
  return await findProductByIdFromStore(id);
}

export async function updateProductAction(id: string, data: Partial<Omit<ValidatedProductFormData, 'initialStock'> & { quantityInStock?: number }>) {
  const updatedProduct = await updateProductInStoreInternal(id, data);
  if (!updatedProduct) {
    return { success: false, message: 'Product not found or update failed.' };
  }
  revalidatePath('/products');
  revalidatePath(`/products/${id}/edit`);
  revalidatePath('/dashboard');
  return { success: true, message: 'Product updated successfully!', product: updatedProduct };
}

export async function deleteProductAction(id: string) {
  const success = await deleteProductFromStoreInternal(id);
  if (!success) {
    return { success: false, message: 'Product not found or delete failed.' };
  }
  revalidatePath('/products');
  revalidatePath('/dashboard');
  return { success: true, message: 'Product deleted successfully!' };
}
