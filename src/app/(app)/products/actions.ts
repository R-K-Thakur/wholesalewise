
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ValidatedProductFormData } from './schema';
import type { Product } from '@/lib/types';

const PRODUCTS_COLLECTION = 'products';

// Helper function to convert Firestore doc data to Product, ensuring Timestamps are strings
const mapDocToProduct = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Product => {
  const data = document.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }
  return {
    id: document.id,
    name: data.name,
    category: data.category,
    purchasePrice: data.purchasePrice,
    retailPrice: data.retailPrice,
    wholesalePrice: data.wholesalePrice,
    unit: data.unit,
    quantityInStock: data.quantityInStock,
    sku: data.sku,
    barcode: data.barcode,
    reorderThreshold: data.reorderThreshold,
    vendor: data.vendor,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
  } as Product;
};


export async function addProduct(data: ValidatedProductFormData) {
  console.log('Adding new product to Firestore:', data);

  if (data.productName.toLowerCase() === 'fail') {
    return { success: false, message: 'Simulated error: Product name cannot be "Fail".' };
  }

  try {
    const now = Timestamp.now().toDate().toISOString();
    const newProductData = {
      name: data.productName,
      category: data.category,
      purchasePrice: data.purchasePrice,
      retailPrice: data.retailPrice,
      wholesalePrice: data.wholesalePrice,
      unit: data.unit,
      quantityInStock: data.initialStock,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), newProductData);
    
    revalidatePath('/products');
    revalidatePath('/dashboard');

    // Construct the product object to return, ensuring dates are strings
    const productToReturn: Product = {
      id: docRef.id,
      ...newProductData, // newProductData already has dates as ISO strings
    };

    return { success: true, message: 'Product added successfully!', product: productToReturn };
  } catch (error) {
    console.error("Error adding product to Firestore:", error);
    return { success: false, message: `Failed to add product: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getProductsAction(): Promise<Product[]> {
  try {
    // Order by createdAt in descending order to get newest products first
    const q = query(collection(db, PRODUCTS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(mapDocToProduct);
    return products;
  } catch (error) {
    console.error("Error fetching products from Firestore:", error);
    return [];
  }
}

export async function getProductByIdAction(id: string): Promise<Product | undefined> {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToProduct(docSnap);
    } else {
      console.log("No such product document!");
      return undefined;
    }
  } catch (error) {
    console.error("Error fetching product by ID from Firestore:", error);
    return undefined;
  }
}

export async function updateProductAction(id: string, data: Partial<ValidatedProductFormData>) {
  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, id);
    
    const updateData: Partial<Omit<Product, 'id' | 'createdAt'>> = {};
    if (data.productName !== undefined) updateData.name = data.productName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice;
    if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.initialStock !== undefined) updateData.quantityInStock = data.initialStock; 

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: 'No changes provided to update.' };
    }
    
    updateData.updatedAt = Timestamp.now().toDate().toISOString();

    await updateDoc(productRef, updateData);

    revalidatePath('/products');
    revalidatePath(`/products/${id}/edit`);
    revalidatePath('/dashboard');

    const updatedDocSnap = await getDoc(productRef);
    if (!updatedDocSnap.exists()) {
        return { success: false, message: 'Product not found after update.' };
    }
    
    return { success: true, message: 'Product updated successfully!', product: mapDocToProduct(updatedDocSnap) };
  } catch (error) {
    console.error("Error updating product in Firestore:", error);
    return { success: false, message: `Failed to update product: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true, message: 'Product deleted successfully!' };
  } catch (error) {
    console.error("Error deleting product from Firestore:", error);
    return { success: false, message: `Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
