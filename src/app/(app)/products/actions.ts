
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ValidatedProductFormData } from './schema';
import type { Product, Purchase } from '@/lib/types';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';

const PRODUCTS_COLLECTION = 'products';
const PURCHASES_COLLECTION = 'purchases';

const mapDocToProduct = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Product => {
  const data = document.data();
  if (!data) {
    throw new Error('Document data is undefined. This should not happen if doc.exists() was checked.');
  }

  const nowAsISO = new Date().toISOString();

  return {
    id: document.id,
    name: typeof data.name === 'string' ? data.name : '',
    category: PRODUCT_CATEGORIES.includes(data.category) ? data.category : PRODUCT_CATEGORIES[0],
    
    baseUnit: PRODUCT_UNITS.includes(data.baseUnit) ? data.baseUnit : PRODUCT_UNITS[0],
    purchaseUnit: PRODUCT_UNITS.includes(data.purchaseUnit) ? data.purchaseUnit : PRODUCT_UNITS[0],
    purchaseUnitConversionFactor: typeof data.purchaseUnitConversionFactor === 'number' ? data.purchaseUnitConversionFactor : 1,
    
    purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : 0, // Per purchase unit
    retailPricePerBaseUnit: typeof data.retailPricePerBaseUnit === 'number' ? data.retailPricePerBaseUnit : 0,
    wholesalePricePerBaseUnit: typeof data.wholesalePricePerBaseUnit === 'number' ? data.wholesalePricePerBaseUnit : 0,
    
    quantityInStock: typeof data.quantityInStock === 'number' ? data.quantityInStock : 0, // In base units
    
    sku: typeof data.sku === 'string' ? data.sku : '',
    barcode: typeof data.barcode === 'string' ? data.barcode : '',
    reorderThreshold: typeof data.reorderThreshold === 'number' ? data.reorderThreshold : 0, // In base units
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
    
    let conversionFactor = data.purchaseUnitConversionFactor;
    if (data.baseUnit === data.purchaseUnit) {
      conversionFactor = 1;
    } else if (data.purchaseUnit === "dozen" && data.baseUnit === "piece") {
      conversionFactor = 12;
    } else if (!conversionFactor || conversionFactor < 1) {
      // This case should be caught by schema validation, but double check
      return { success: false, message: 'Invalid conversion factor.' };
    }

    // Initial stock from form is in purchase units. Convert to base units for storage.
    const quantityInBaseUnits = data.initialStock * conversionFactor;

    const newProductData = {
      name: data.productName,
      category: data.category,
      baseUnit: data.baseUnit,
      purchaseUnit: data.purchaseUnit,
      purchaseUnitConversionFactor: conversionFactor,
      purchasePrice: data.purchasePrice, // This is per purchase unit
      retailPricePerBaseUnit: data.retailPricePerBaseUnit,
      wholesalePricePerBaseUnit: data.wholesalePricePerBaseUnit,
      quantityInStock: quantityInBaseUnits, // Stored in base units
      reorderThreshold: data.reorderThreshold ?? 0,
      sku: '', 
      barcode: '',
      vendor: '',
      createdAt: now,
      updatedAt: now,
    };
    
    // Use a transaction to add the product and its initial purchase record
    const productDocRef = await runTransaction(db, async (transaction) => {
      const newProductRef = doc(collection(db, PRODUCTS_COLLECTION)); // Generate a new ref for product
      transaction.set(newProductRef, newProductData);

      // Create a purchase record for the initial stock
      // data.initialStock is in purchaseUnits
      // data.purchasePrice is per purchaseUnit
      const initialPurchaseRecord: Omit<Purchase, 'id'> = {
        productId: newProductRef.id,
        productNameSnapshot: data.productName,
        quantityPurchased: data.initialStock,
        purchaseUnitSnapshot: data.purchaseUnit,
        purchasePricePerUnitSnapshot: data.purchasePrice,
        totalCost: data.initialStock * data.purchasePrice,
        purchaseDate: now, // Use the same creation date as the product for this initial "purchase"
        createdAt: now,
        updatedAt: now,
      };
      const purchaseDocRef = doc(collection(db, PURCHASES_COLLECTION));
      transaction.set(purchaseDocRef, initialPurchaseRecord);
      
      return newProductRef; // Return the product reference
    });

    revalidatePath('/products');
    revalidatePath('/dashboard'); // For low stock, product search, and purchase history

    const productToReturn: Product = {
      id: productDocRef.id, // Use the ID from the transaction result
      ...newProductData, 
    };

    return { success: true, message: 'Product added successfully and initial stock recorded as purchase!', product: productToReturn };
  } catch (error) {
    console.error("Error adding product and initial purchase to Firestore:", error);
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
    
    const updateData: { [key: string]: any } = {}; 
    if (data.productName !== undefined) updateData.name = data.productName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.baseUnit !== undefined) updateData.baseUnit = data.baseUnit;
    if (data.purchaseUnit !== undefined) updateData.purchaseUnit = data.purchaseUnit;
    
    const currentDocSnap = await getDoc(productRef);
    if (!currentDocSnap.exists()) {
        return { success: false, message: 'Product not found.' };
    }
    const currentProductData = currentDocSnap.data();

    const finalBaseUnit = data.baseUnit || currentProductData?.baseUnit;
    const finalPurchaseUnit = data.purchaseUnit || currentProductData?.purchaseUnit;

    if (finalBaseUnit === finalPurchaseUnit) {
        updateData.purchaseUnitConversionFactor = 1;
    } else if (finalPurchaseUnit === "dozen" && finalBaseUnit === "piece") {
        updateData.purchaseUnitConversionFactor = 12;
    } else if (data.purchaseUnitConversionFactor !== undefined && data.purchaseUnitConversionFactor >= 1) {
        updateData.purchaseUnitConversionFactor = data.purchaseUnitConversionFactor;
    } else if (finalBaseUnit !== finalPurchaseUnit) {
        if (currentProductData.purchaseUnitConversionFactor && currentProductData.purchaseUnitConversionFactor >=1){
             if (data.purchaseUnitConversionFactor === undefined) { // if not being explicitly updated
                updateData.purchaseUnitConversionFactor = currentProductData.purchaseUnitConversionFactor;
             } else { // explicitly updated to something invalid (caught by schema for forms)
                 return { success: false, message: 'Conversion factor is required and must be >= 1 if base and purchase units differ (and not dozen/piece).' };
             }
        } else {
             return { success: false, message: 'Conversion factor is required and must be >= 1 if base and purchase units differ (and not dozen/piece).' };
        }
    }


    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.retailPricePerBaseUnit !== undefined) updateData.retailPricePerBaseUnit = data.retailPricePerBaseUnit;
    if (data.wholesalePricePerBaseUnit !== undefined) updateData.wholesalePricePerBaseUnit = data.wholesalePricePerBaseUnit;
    // 'initialStock' from form maps to 'quantityInStock' (base units) for editing
    if (data.initialStock !== undefined) updateData.quantityInStock = data.initialStock; 
    if (data.reorderThreshold !== undefined) updateData.reorderThreshold = data.reorderThreshold;


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

export async function addStockToProductAction(
  productId: string, 
  quantityAddedInPurchaseUnits: number, 
  newPurchasePricePerPurchaseUnit?: number
): Promise<{ success: boolean; message: string }> {
  if (!productId) {
    return { success: false, message: "Product ID is required." };
  }
  if (quantityAddedInPurchaseUnits <= 0) {
    return { success: false, message: "Quantity to add must be positive." };
  }

  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, productId);
    // const purchaseCollectionRef = collection(db, PURCHASES_COLLECTION); // Not needed if doc ref is generated inside transaction

    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("Product not found.");
      }

      const productData = productDoc.data(); // Raw data, mapDocToProduct isn't easily usable in transaction directly
      if (!productData) throw new Error("Product data is missing.");

      const conversionFactor = productData.purchaseUnitConversionFactor || 1;
      const quantityAddedInBaseUnits = quantityAddedInPurchaseUnits * conversionFactor;

      const newStockInBaseUnits = (productData.quantityInStock || 0) + quantityAddedInBaseUnits;
      const nowISO = Timestamp.now().toDate().toISOString();

      const productUpdatePayload: any = {
        quantityInStock: newStockInBaseUnits,
        updatedAt: nowISO,
      };

      let purchasePriceForRecord = productData.purchasePrice;
      if (newPurchasePricePerPurchaseUnit !== undefined && newPurchasePricePerPurchaseUnit >= 0) {
        productUpdatePayload.purchasePrice = newPurchasePricePerPurchaseUnit;
        purchasePriceForRecord = newPurchasePricePerPurchaseUnit;
      }
      
      transaction.update(productRef, productUpdatePayload);

      // Create a purchase record
      const purchaseRecord: Omit<Purchase, 'id'> = {
        productId: productId,
        productNameSnapshot: productData.name || 'Unknown Product', // Fallback if name somehow missing
        quantityPurchased: quantityAddedInPurchaseUnits,
        purchaseUnitSnapshot: productData.purchaseUnit || PRODUCT_UNITS[0], // Fallback
        purchasePricePerUnitSnapshot: purchasePriceForRecord,
        totalCost: quantityAddedInPurchaseUnits * purchasePriceForRecord,
        purchaseDate: nowISO,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      // Generate a new doc ref for the purchase record within the transaction
      const purchaseDocRef = doc(collection(db, PURCHASES_COLLECTION));
      transaction.set(purchaseDocRef, purchaseRecord);
    });

    revalidatePath('/products');
    revalidatePath(`/products/${productId}/edit`);
    revalidatePath('/dashboard'); // For purchase history chart and low stock widget
    
    return { success: true, message: "Stock added and purchase recorded successfully!" };
  } catch (error) {
    console.error("Error adding stock to product:", error);
    return { success: false, message: `Failed to add stock: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// Action to fetch purchase records
export async function getPurchasesAction(): Promise<Purchase[]> {
  try {
    const q = query(collection(db, PURCHASES_COLLECTION), orderBy("purchaseDate", "desc"));
    const querySnapshot = await getDocs(q);
    const purchases = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const nowAsISO = new Date().toISOString();
      // Ensure purchaseDate is handled correctly, whether it's a Firestore Timestamp or already a string
      let purchaseDateString = nowAsISO;
      if (data.purchaseDate) {
        if (typeof data.purchaseDate === 'string') {
          purchaseDateString = data.purchaseDate;
        } else if (data.purchaseDate.toDate) { // Check if it's a Firestore Timestamp
          purchaseDateString = data.purchaseDate.toDate().toISOString();
        }
      }

      let createdAtString = nowAsISO;
       if (data.createdAt) {
        if (typeof data.createdAt === 'string') {
          createdAtString = data.createdAt;
        } else if (data.createdAt.toDate) {
          createdAtString = data.createdAt.toDate().toISOString();
        }
      }

      let updatedAtString = nowAsISO;
      if (data.updatedAt) {
        if (typeof data.updatedAt === 'string') {
          updatedAtString = data.updatedAt;
        } else if (data.updatedAt.toDate) {
          updatedAtString = data.updatedAt.toDate().toISOString();
        }
      }
      
      return {
        id: docSnap.id,
        productId: data.productId || '',
        productNameSnapshot: data.productNameSnapshot || '',
        quantityPurchased: data.quantityPurchased || 0,
        purchaseUnitSnapshot: PRODUCT_UNITS.includes(data.purchaseUnitSnapshot) ? data.purchaseUnitSnapshot : PRODUCT_UNITS[0],
        purchasePricePerUnitSnapshot: data.purchasePricePerUnitSnapshot || 0,
        totalCost: data.totalCost || 0,
        purchaseDate: purchaseDateString,
        createdAt: createdAtString,
        updatedAt: updatedAtString,
      } as Purchase;
    });
    return purchases;
  } catch (error) {
    console.error("Error fetching purchases from Firestore:", error);
    return [];
  }
}

