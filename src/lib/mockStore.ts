
// This file is no longer used for product management as Firebase Firestore is now integrated.
// It can be safely removed or kept if it's planned to be used for other mock data in the future.

// 'use server'; 

// import type { Product } from './types';
// import type { ValidatedProductFormData } from '@/app/(app)/products/schema';

// const initialMockProducts: Product[] = [
//   { id: "1", name: "Lavender Lipstick", category: "Makeup", quantityInStock: 150, retailPrice: 999.00, purchasePrice: 350, wholesalePrice: 500, unit: "piece", sku: "LL001", barcode: "1234567890123", reorderThreshold: 20, vendor: "Cosmetics Co.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
//   { id: "2", name: "Teal Hair Oil", category: "Hair Oils", quantityInStock: 80, retailPrice: 650.00, purchasePrice: 280, wholesalePrice: 400, unit: "piece", sku: "THO002", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
//   { id: "3", name: "Silver Earrings", category: "Imitation Jewellery", quantityInStock: 200, retailPrice: 1999.00, purchasePrice: 1200, wholesalePrice: 1500, unit: "set", sku: "SE003", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
// ];

// let productsStore: Product[] = [...initialMockProducts];
// let nextId = initialMockProducts.length > 0 ? Math.max(...initialMockProducts.map(p => parseInt(p.id))) + 1 : 1;

// export async function getAllProducts(): Promise<Product[]> {
//   return JSON.parse(JSON.stringify(productsStore));
// }

// export async function addProductToStore(productData: ValidatedProductFormData): Promise<Product> {
//   const newProduct: Product = {
//     id: String(nextId++),
//     name: productData.productName,
//     category: productData.category,
//     purchasePrice: productData.purchasePrice,
//     retailPrice: productData.retailPrice,
//     wholesalePrice: productData.wholesalePrice,
//     unit: productData.unit,
//     quantityInStock: productData.initialStock,
//     sku: `SKU${nextId-1}`, 
//     createdAt: new Date().toISOString(),
//     updatedAt: new Date().toISOString(),
//   };
//   productsStore.push(newProduct);
//   return JSON.parse(JSON.stringify(newProduct));
// }

// export async function findProductById(id: string): Promise<Product | undefined> {
//   const product = productsStore.find(p => p.id === id);
//   return product ? JSON.parse(JSON.stringify(product)) : undefined;
// }

// export async function updateProductInStore(id: string, updates: Partial<Omit<ValidatedProductFormData, 'initialStock'> & { quantityInStock?: number }>): Promise<Product | null> {
//     const productIndex = productsStore.findIndex(p => p.id === id);
//     if (productIndex === -1) {
//         return null;
//     }
    
//     const existingProduct = productsStore[productIndex];
    
//     const updatedProductFields = {
//         name: updates.productName !== undefined ? updates.productName : existingProduct.name,
//         category: updates.category !== undefined ? updates.category : existingProduct.category,
//         purchasePrice: updates.purchasePrice !== undefined ? updates.purchasePrice : existingProduct.purchasePrice,
//         retailPrice: updates.retailPrice !== undefined ? updates.retailPrice : existingProduct.retailPrice,
//         wholesalePrice: updates.wholesalePrice !== undefined ? updates.wholesalePrice : existingProduct.wholesalePrice,
//         unit: updates.unit !== undefined ? updates.unit : existingProduct.unit,
//         quantityInStock: updates.quantityInStock !== undefined ? updates.quantityInStock : existingProduct.quantityInStock,
//     };

//     productsStore[productIndex] = {
//         ...existingProduct,
//         ...updatedProductFields,
//         updatedAt: new Date().toISOString(),
//     };
//     return JSON.parse(JSON.stringify(productsStore[productIndex]));
// }

// export async function deleteProductFromStore(id: string): Promise<boolean> {
//     const initialLength = productsStore.length;
//     productsStore = productsStore.filter(p => p.id !== id);
//     return productsStore.length < initialLength;
// }
