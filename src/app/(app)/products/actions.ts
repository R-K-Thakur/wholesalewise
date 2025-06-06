
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, runTransaction } from 'firebase/firestore';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/firebase';
import type { ValidatedProductFormData } from './schema';
import type { Product, Purchase } from '@/lib/types';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/lib/constants';
import { getSession, type SessionData } from '@/app/login/actions'; // Import getSession

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

    purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : 0,
    retailPricePerBaseUnit: typeof data.retailPricePerBaseUnit === 'number' ? data.retailPricePerBaseUnit : 0,
    wholesalePricePerBaseUnit: typeof data.wholesalePricePerBaseUnit === 'number' ? data.wholesalePricePerBaseUnit : 0,

    quantityInStock: typeof data.quantityInStock === 'number' ? data.quantityInStock : 0,

    sku: typeof data.sku === 'string' ? data.sku : '',
    barcode: typeof data.barcode === 'string' ? data.barcode : '',
    reorderThreshold: typeof data.reorderThreshold === 'number' ? data.reorderThreshold : 0,
    vendor: typeof data.vendor === 'string' ? data.vendor : '',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || nowAsISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || nowAsISO),
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : undefined,
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined, // Added
    lastStockUpdateByEmail: typeof data.lastStockUpdateByEmail === 'string' ? data.lastStockUpdateByEmail : undefined,
    lastStockUpdateByName: typeof data.lastStockUpdateByName === 'string' ? data.lastStockUpdateByName : undefined, // Added
  };
};


export async function addProduct(data: ValidatedProductFormData) {
  console.log('Adding new product to Firestore:', data);

  if (data.productName.toLowerCase() === 'fail') {
    return { success: false, message: 'Simulated error: Product name cannot be "Fail".' };
  }

  const session = await getSession();
  if (!session) {
    return { success: false, message: "User session not found or invalid. Cannot add product." };
  }
  const userEmail = session.email;
  const userName = session.name; // Use display name
  console.log(`[addProduct] Adding product. User Name: '${userName}', User Email: '${userEmail}'`);


  try {
    const now = Timestamp.now().toDate().toISOString();

    let conversionFactor = data.purchaseUnitConversionFactor;
    if (data.baseUnit === data.purchaseUnit) {
      conversionFactor = 1;
    } else if (data.purchaseUnit === "dozen" && data.baseUnit === "piece") {
      conversionFactor = 12;
    } else if (!conversionFactor || conversionFactor < 1) {
      return { success: false, message: 'Invalid conversion factor.' };
    }

    const quantityInBaseUnits = data.initialStock * conversionFactor;

    const newProductData: Omit<Product, 'id'> = {
      name: data.productName,
      category: data.category,
      baseUnit: data.baseUnit,
      purchaseUnit: data.purchaseUnit,
      purchaseUnitConversionFactor: conversionFactor,
      purchasePrice: data.purchasePrice,
      retailPricePerBaseUnit: data.retailPricePerBaseUnit,
      wholesalePricePerBaseUnit: data.wholesalePricePerBaseUnit,
      quantityInStock: quantityInBaseUnits,
      reorderThreshold: data.reorderThreshold ?? 0,
      sku: '',
      barcode: '',
      vendor: '',
      createdAt: now,
      updatedAt: now,
      createdByEmail: userEmail,
      createdByName: userName, // Store display name
      lastStockUpdateByEmail: userEmail,
      lastStockUpdateByName: userName, // Store display name
    };

    const productDocRef = await runTransaction(db, async (transaction) => {
      const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
      transaction.set(newProductRef, newProductData);

      // The initialStock from the form is in purchaseUnits.
      // The initialPurchaseRecord should log this quantity in purchaseUnits.
      const initialPurchaseRecord: Omit<Purchase, 'id'> = {
        productId: newProductRef.id,
        productNameSnapshot: data.productName,
        quantityPurchased: data.initialStock, // This is the quantity in purchase units
        purchaseUnitSnapshot: data.purchaseUnit,
        purchasePricePerUnitSnapshot: data.purchasePrice,
        totalCost: data.initialStock * data.purchasePrice, // Cost based on purchase units
        purchaseDate: now,
        createdAt: now,
        updatedAt: now,
        recordedByEmail: userEmail,
        recordedByName: userName, // Store display name
      };
      const purchaseDocRef = doc(collection(db, PURCHASES_COLLECTION));
      transaction.set(purchaseDocRef, initialPurchaseRecord);

      return newProductRef;
    });

    revalidateTag('products');
    revalidateTag('purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');

    const productToReturn: Product = {
      id: productDocRef.id,
      ...newProductData,
    };

    return { success: true, message: 'Product added successfully and initial stock recorded as purchase!', product: productToReturn };
  } catch (error) {
    console.error("Error adding product and initial purchase to Firestore:", error);
    return { success: false, message: `Failed to add product: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

const getProductsCached = unstable_cache(
  async () => {
    console.log('[getProductsAction_CACHE_WRAPPER] Cache miss or revalidating: Fetching products from Firestore');
    try {
      const q = query(collection(db, PRODUCTS_COLLECTION), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(mapDocToProduct);
      return products;
    } catch (error) {
      console.error("Error fetching products from Firestore (within cache wrapper):", error);
      return [];
    }
  },
  ['products_list'],
  {
    revalidate: 300, // 5 minutes
    tags: ['products'],
  }
);

export async function getProductsAction(): Promise<Product[]> {
  return getProductsCached();
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
  const session = await getSession();
  if (!session) {
    return { success: false, message: "User session not found. Please log in." };
  }
  const userEmail = session.email;
  const userName = session.name; // Use display name
  const userRole = session.role;
  console.log(`[updateProductAction] Updating product. User Name: '${userName}', User Email: '${userEmail}'`);


  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, id);

    const currentDocSnap = await getDoc(productRef);
    if (!currentDocSnap.exists()) {
        return { success: false, message: 'Product not found.' };
    }
    const currentProductData = currentDocSnap.data() as Product;

    const updateData: { [key: string]: any } = {};
    if (data.productName !== undefined) updateData.name = data.productName;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.baseUnit !== undefined) updateData.baseUnit = data.baseUnit;
    if (data.purchaseUnit !== undefined) updateData.purchaseUnit = data.purchaseUnit;

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
             if (data.purchaseUnitConversionFactor === undefined) {
                updateData.purchaseUnitConversionFactor = currentProductData.purchaseUnitConversionFactor;
             } else {
                 return { success: false, message: 'Conversion factor is required and must be >= 1 if base and purchase units differ (and not dozen/piece).' };
             }
        } else {
             return { success: false, message: 'Conversion factor is required and must be >= 1 if base and purchase units differ (and not dozen/piece).' };
        }
    }


    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.retailPricePerBaseUnit !== undefined) updateData.retailPricePerBaseUnit = data.retailPricePerBaseUnit;
    if (data.wholesalePricePerBaseUnit !== undefined) updateData.wholesalePricePerBaseUnit = data.wholesalePricePerBaseUnit;

    if (data.initialStock !== undefined) {
        if (userRole === 'staff' && data.initialStock < currentProductData.quantityInStock) {
            return {
                success: false,
                message: `Staff members cannot decrease stock quantity. Current stock is ${currentProductData.quantityInStock} ${currentProductData.baseUnit}. Please enter a value greater than or equal to this.`
            };
        }

        if (data.initialStock !== currentProductData.quantityInStock) {
            updateData.quantityInStock = data.initialStock;
            updateData.lastStockUpdateByEmail = userEmail;
            updateData.lastStockUpdateByName = userName; // Store display name
        } else if (updateData.quantityInStock === undefined) {
        }
    }
    if (data.reorderThreshold !== undefined) updateData.reorderThreshold = data.reorderThreshold;


    if (Object.keys(updateData).length === 0) {
      return { success: true, message: 'No changes provided to update.' };
    }

    updateData.updatedAt = Timestamp.now().toDate().toISOString();

    await updateDoc(productRef, updateData);

    revalidateTag('products');
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
    revalidateTag('products');
    revalidateTag('sales');
    revalidateTag('purchases');
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

  const session = await getSession();
  if (!session) {
    return { success: false, message: "User session not found. Please log in." };
  }
  const userEmail = session.email;
  const userName = session.name; // Use display name
  console.log(`[addStockToProductAction] Adding stock. User Name: '${userName}', User Email: '${userEmail}'`);


  try {
    const productRef = doc(db, PRODUCTS_COLLECTION, productId);

    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("Product not found.");
      }

      const productData = productDoc.data();
      if (!productData) throw new Error("Product data is missing.");

      const conversionFactor = productData.purchaseUnitConversionFactor || 1;
      const quantityAddedInBaseUnits = quantityAddedInPurchaseUnits * conversionFactor;

      const newStockInBaseUnits = (productData.quantityInStock || 0) + quantityAddedInBaseUnits;
      const nowISO = Timestamp.now().toDate().toISOString();

      const productUpdatePayload: any = {
        quantityInStock: newStockInBaseUnits,
        updatedAt: nowISO,
        lastStockUpdateByEmail: userEmail,
        lastStockUpdateByName: userName, // Store display name
      };

      let purchasePriceForRecord = productData.purchasePrice;
      if (newPurchasePricePerPurchaseUnit !== undefined && newPurchasePricePerPurchaseUnit >= 0) {
        productUpdatePayload.purchasePrice = newPurchasePricePerPurchaseUnit;
        purchasePriceForRecord = newPurchasePricePerPurchaseUnit;
      }

      transaction.update(productRef, productUpdatePayload);

      const purchaseRecord: Omit<Purchase, 'id'> = {
        productId: productId,
        productNameSnapshot: productData.name || 'Unknown Product',
        quantityPurchased: quantityAddedInPurchaseUnits,
        purchaseUnitSnapshot: productData.purchaseUnit || PRODUCT_UNITS[0],
        purchasePricePerUnitSnapshot: purchasePriceForRecord,
        totalCost: quantityAddedInPurchaseUnits * purchasePriceForRecord,
        purchaseDate: nowISO,
        createdAt: nowISO,
        updatedAt: nowISO,
        recordedByEmail: userEmail,
        recordedByName: userName, // Store display name
      };
      const purchaseDocRef = doc(collection(db, PURCHASES_COLLECTION));
      transaction.set(purchaseDocRef, purchaseRecord);
    });

    revalidateTag('products');
    revalidateTag('purchases');
    revalidatePath('/products');
    revalidatePath(`/products/${productId}/edit`);
    revalidatePath('/dashboard');

    return { success: true, message: "Stock added and purchase recorded successfully!" };
  } catch (error) {
    console.error("Error adding stock to product:", error);
    return { success: false, message: `Failed to add stock: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

const getPurchasesCached = unstable_cache(
  async () => {
    console.log('[getPurchasesAction_CACHE_WRAPPER] Cache miss or revalidating: Fetching purchases from Firestore');
    try {
      const q = query(collection(db, PURCHASES_COLLECTION), orderBy("purchaseDate", "desc"));
      const querySnapshot = await getDocs(q);
      const purchases = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const nowAsISO = new Date().toISOString();
        let purchaseDateString = nowAsISO;
        if (data.purchaseDate) {
          if (typeof data.purchaseDate === 'string') {
            purchaseDateString = data.purchaseDate;
          } else if (data.purchaseDate.toDate) {
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
          recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
          recordedByName: typeof data.recordedByName === 'string' ? data.recordedByName : undefined,
        } as Purchase;
      });
      return purchases;
    } catch (error) {
      console.error("Error fetching purchases from Firestore (within cache wrapper):", error);
      return [];
    }
  },
  ['purchases_list'],
  {
    revalidate: 300, // 5 minutes
    tags: ['purchases'],
  }
);

export async function getPurchasesAction(): Promise<Purchase[]> {
  return getPurchasesCached();
}
