
'use server'; // Can be 'use server' if functions are only called by server actions, or just a TS module.
              // For simplicity and since actions will import it, let's treat it as a server-side module.

import type { Product } from './types';
import type { ValidatedProductFormData } from '@/app/(app)/products/schema';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from './constants'; // For type safety if needed

// Initial mock data, ensuring it matches the Product type from src/lib/types.ts
const initialMockProducts: Product[] = [
  { id: "1", name: "Lavender Lipstick", category: "Makeup", quantityInStock: 150, retailPrice: 999.00, purchasePrice: 350, wholesalePrice: 500, unit: "piece", sku: "LL001", barcode: "1234567890123", reorderThreshold: 20, vendor: "Cosmetics Co.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "2", name: "Teal Hair Oil", category: "Hair Oils", quantityInStock: 80, retailPrice: 650.00, purchasePrice: 280, wholesalePrice: 400, unit: "piece", sku: "THO002", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "3", name: "Silver Earrings", category: "Imitation Jewellery", quantityInStock: 200, retailPrice: 1999.00, purchasePrice: 1200, wholesalePrice: 1500, unit: "set", sku: "SE003", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

let productsStore: Product[] = [...initialMockProducts];
let nextId = initialMockProducts.length > 0 ? Math.max(...initialMockProducts.map(p => parseInt(p.id))) + 1 : 1;

export function getAllProducts(): Product[] {
  // Return a copy to prevent direct modification of the store array
  return JSON.parse(JSON.stringify(productsStore));
}

export function addProductToStore(productData: ValidatedProductFormData): Product {
  const newProduct: Product = {
    id: String(nextId++),
    name: productData.productName,
    category: productData.category,
    purchasePrice: productData.purchasePrice,
    retailPrice: productData.retailPrice,
    wholesalePrice: productData.wholesalePrice,
    unit: productData.unit,
    quantityInStock: productData.initialStock,
    // Optional fields can be added if provided in form or set to defaults
    sku: `SKU${nextId-1}`, // Example SKU
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  productsStore.push(newProduct);
  return JSON.parse(JSON.stringify(newProduct));
}

export function findProductById(id: string): Product | undefined {
  const product = productsStore.find(p => p.id === id);
  return product ? JSON.parse(JSON.stringify(product)) : undefined;
}

export function updateProductInStore(id: string, updates: Partial<Omit<ValidatedProductFormData, 'initialStock'> & { quantityInStock?: number }>): Product | null {
    const productIndex = productsStore.findIndex(p => p.id === id);
    if (productIndex === -1) {
        return null;
    }
    
    const existingProduct = productsStore[productIndex];
    
    // Map ValidatedProductFormData fields to Product fields if names differ (e.g. productName to name)
    const updatedProductFields = {
        name: updates.productName !== undefined ? updates.productName : existingProduct.name,
        category: updates.category !== undefined ? updates.category : existingProduct.category,
        purchasePrice: updates.purchasePrice !== undefined ? updates.purchasePrice : existingProduct.purchasePrice,
        retailPrice: updates.retailPrice !== undefined ? updates.retailPrice : existingProduct.retailPrice,
        wholesalePrice: updates.wholesalePrice !== undefined ? updates.wholesalePrice : existingProduct.wholesalePrice,
        unit: updates.unit !== undefined ? updates.unit : existingProduct.unit,
        quantityInStock: updates.quantityInStock !== undefined ? updates.quantityInStock : existingProduct.quantityInStock,
    };

    productsStore[productIndex] = {
        ...existingProduct,
        ...updatedProductFields,
        updatedAt: new Date().toISOString(),
    };
    return JSON.parse(JSON.stringify(productsStore[productIndex]));
}

export function deleteProductFromStore(id: string): boolean {
    const initialLength = productsStore.length;
    productsStore = productsStore.filter(p => p.id !== id);
    return productsStore.length < initialLength;
}
