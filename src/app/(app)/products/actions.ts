
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ValidatedProductFormData } from './schema';
import type { Product } from '@/lib/types';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';

const PRODUCTS_COLLECTION = 'products';

// Helper function to convert Firestore doc data to Product, ensuring Timestamps are strings
// and providing defaults for potentially missing fields.
const mapDocToProduct = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Product => {
  const data = document.data();
  if (!data) {
    // This case should ideally be caught by checking doc.exists() before calling mapDocToProduct
    throw new Error('Document data is undefined. This should not happen if doc.exists() was checked.');
  }

  const nowAsISO = new Date().toISOString();

  return {
    id: document.id,
    name: typeof data.name === 'string' ? data.name : '',
    category: PRODUCT_CATEGORIES.includes(data.category) ? data.category : PRODUCT_CATEGORIES[0],
    purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : 0,
    retailPrice: typeof data.retailPrice === 'number' ? data.retailPrice : 0,
    wholesalePrice: typeof data.wholesalePrice === 'number' ? data.wholesalePrice : 0,
    unit: PRODUCT_UNITS.includes(data.unit) ? data.unit : PRODUCT_UNITS[0],
    quantityInStock: typeof data.quantityInStock === 'number' ? data.quantityInStock : 0,
    sku: typeof data.sku === 'string' ? data.sku : '',
    barcode: typeof data.barcode === 'string' ? data.barcode : '',
    reorderThreshold: typeof data.reorderThreshold === 'number' ? data.reorderThreshold : 0,
    vendor: typeof data.vendor === 'string' ? data.vendor : '',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || nowAsISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || nowAsISO),
  };
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
      // Initialize optional fields to ensure they exist in Firestore
      sku: '', 
      barcode: '',
      reorderThreshold: 0,
      vendor: '',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), newProductData);
    
    revalidatePath('/products');
    revalidatePath('/dashboard');

    const productToReturn: Product = {
      id: docRef.id,
      ...newProductData, 
    };

    return { success: true, message: 'Product added successfully!', product: productToReturn };
  } catch (error) {
    console.error("Error adding product to Firestore:", error);
    return { success: false, message: `Failed to add product: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getProductsAction(): Promise<Product[]> {
  try {
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
    
    // Ensure we only attempt to update fields that are actually part of the form schema
    // and are defined in the incoming data.
    const updateData: { [key: string]: any } = {}; 
    if (data.productName !== undefined) updateData.name = data.productName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.retailPrice !== undefined) updateData.retailPrice = data.retailPrice;
    if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice;
    if (data.unit !== undefined) updateData.unit = data.unit;
    // 'initialStock' from form maps to 'quantityInStock' in DB for editing
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
        // This case should be rare if the update was successful on an existing doc
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
