'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PurchaseBill, PurchaseBillFormData, PurchaseBillItem, Purchase } from '@/lib/types';
import { getSession } from '@/app/login/actions';
import { purchaseBillFormSchema } from './schema';
import { getFromMemoryCache, setMemoryCache, invalidateMemoryCache } from '@/lib/memory-cache';

const PURCHASE_BILLS_COLLECTION = 'purchase_bills';
const PURCHASES_COLLECTION = 'purchases';
const PRODUCTS_COLLECTION = 'products';

const mapDocToPurchaseBill = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): PurchaseBill => {
  const data = document.data();
  if (!data) {
    throw new Error('Purchase bill document data is undefined.');
  }
  const nowISO = new Date().toISOString();

  let purchaseDateString = nowISO;
  if (data.purchaseDate) {
    if (typeof data.purchaseDate === 'string') {
      purchaseDateString = data.purchaseDate;
    } else if (data.purchaseDate.toDate) {
      purchaseDateString = data.purchaseDate.toDate().toISOString();
    }
  }

  let createdAtString = nowISO;
  if (data.createdAt) {
    if (typeof data.createdAt === 'string') {
      createdAtString = data.createdAt;
    } else if (data.createdAt.toDate) {
      createdAtString = data.createdAt.toDate().toISOString();
    }
  }

  let updatedAtString = nowISO;
  if (data.updatedAt) {
    if (typeof data.updatedAt === 'string') {
      updatedAtString = data.updatedAt;
    } else if (data.updatedAt.toDate) {
      updatedAtString = data.updatedAt.toDate().toISOString();
    }
  }

  return {
    id: document.id,
    invoiceNumber: typeof data.invoiceNumber === 'string' ? data.invoiceNumber : undefined,
    supplierName: typeof data.supplierName === 'string' ? data.supplierName : 'Unknown Supplier',
    supplierPhone: typeof data.supplierPhone === 'string' ? data.supplierPhone : undefined,
    purchaseDate: purchaseDateString,
    items: Array.isArray(data.items) ? data.items : [],
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
    amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : 0,
    amountDue: typeof data.amountDue === 'number' ? data.amountDue : 0,
    paymentStatus: ['paid', 'partially_paid', 'unpaid'].includes(data.paymentStatus) ? data.paymentStatus : 'paid',
    paymentMethod: ['cash', 'bank_transfer', 'upi', 'cheque', 'credit'].includes(data.paymentMethod) ? data.paymentMethod : 'cash',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    createdAt: createdAtString,
    updatedAt: updatedAtString,
    recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
    recordedByName: typeof data.recordedByName === 'string' ? data.recordedByName : undefined,
  };
};

const getPurchaseBillsCached = unstable_cache(
  async () => {
    try {
      const snap = await getDocs(collection(db, PURCHASE_BILLS_COLLECTION));
      const bills = snap.docs.map(mapDocToPurchaseBill);
      return bills.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    } catch (error) {
      console.error('Error fetching purchase bills from Firestore:', error);
      return [];
    }
  },
  ['purchase_bills_list'],
  {
    revalidate: 300,
    tags: ['purchases'],
  }
);

export async function getPurchaseBillsAction(): Promise<PurchaseBill[]> {
  const memoryCached = getFromMemoryCache<PurchaseBill[]>('purchase_bills');
  if (memoryCached) return memoryCached;
  const bills = await getPurchaseBillsCached();
  setMemoryCache('purchase_bills', bills, 60);
  return bills;
}

export async function getPurchaseBillByIdAction(id: string): Promise<PurchaseBill | null> {
  try {
    const docRef = doc(db, PURCHASE_BILLS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return mapDocToPurchaseBill(snap);
  } catch (error) {
    console.error(`Error fetching purchase bill ${id}:`, error);
    return null;
  }
}

export async function recordPurchaseBillAction(
  formData: PurchaseBillFormData
): Promise<{ success: boolean; message: string; billId?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in.' };
  }

  const validation = purchaseBillFormSchema.safeParse(formData);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || 'Invalid form data.';
    return { success: false, message: firstError };
  }

  const data = validation.data;
  const nowISO = new Date().toISOString();

  try {
    const billDocRef = doc(collection(db, PURCHASE_BILLS_COLLECTION));
    const billId = billDocRef.id;

    await runTransaction(db, async (transaction) => {
      // 1. READ PHASE: Get all products involved in this purchase bill
      const productReads = await Promise.all(
        data.items.map((item) => transaction.get(doc(db, PRODUCTS_COLLECTION, item.productId)))
      );

      for (let i = 0; i < productReads.length; i++) {
        const prodSnap = productReads[i];
        if (!prodSnap.exists()) {
          throw new Error(`Product not found for item at row ${i + 1}.`);
        }
      }

      // 2. WRITE PHASE: Prepare updates
      let calculatedTotal = 0;
      const billItems: PurchaseBillItem[] = [];
      const individualPurchaseDocRefs: { ref: any; data: Purchase }[] = [];

      for (let i = 0; i < data.items.length; i++) {
        const itemInput = data.items[i];
        const prodSnap = productReads[i];
        const prodData = prodSnap.data() || {};

        const conversionFactor = prodData.purchaseUnitConversionFactor || 1;
        const quantityAddedInBaseUnits = itemInput.quantityPurchased * conversionFactor;
        const newStockInBaseUnits = (prodData.quantityInStock || 0) + quantityAddedInBaseUnits;
        const itemTotal = parseFloat((itemInput.quantityPurchased * itemInput.purchasePricePerUnit).toFixed(2));
        calculatedTotal += itemTotal;

        billItems.push({
          productId: itemInput.productId,
          productNameSnapshot: prodData.name || 'Unknown Product',
          quantityPurchased: itemInput.quantityPurchased,
          purchasePricePerUnit: itemInput.purchasePricePerUnit,
          purchaseUnit: itemInput.purchaseUnit,
          itemTotal,
          conversionFactorSnapshot: conversionFactor,
        });

        // Update product document
        const productUpdate: any = {
          quantityInStock: newStockInBaseUnits,
          updatedAt: nowISO,
          lastStockUpdateByEmail: session.email,
          lastStockUpdateByName: session.name,
        };

        // Update product purchase price if owner, or if product had no price
        if (session.role === 'owner' || (prodData.purchasePrice === 0 && itemInput.purchasePricePerUnit > 0)) {
          productUpdate.purchasePrice = itemInput.purchasePricePerUnit;
        }

        transaction.update(doc(db, PRODUCTS_COLLECTION, itemInput.productId), productUpdate);

        // Prepare synchronized item entry in purchases collection
        const itemPurchaseRef = doc(collection(db, PURCHASES_COLLECTION));
        const itemPurchaseData: Purchase = {
          id: itemPurchaseRef.id,
          productId: itemInput.productId,
          productNameSnapshot: prodData.name || 'Unknown Product',
          quantityPurchased: itemInput.quantityPurchased,
          purchaseUnitSnapshot: itemInput.purchaseUnit,
          purchasePricePerUnitSnapshot: itemInput.purchasePricePerUnit,
          totalCost: itemTotal,
          purchaseDate: data.purchaseDate,
          createdAt: nowISO,
          updatedAt: nowISO,
          recordedByEmail: session.email,
          recordedByName: session.name,
          purchaseBillId: billId,
        };
        individualPurchaseDocRefs.push({ ref: itemPurchaseRef, data: itemPurchaseData });
      }

      calculatedTotal = parseFloat(calculatedTotal.toFixed(2));
      const amountPaid = parseFloat(Math.min(calculatedTotal, data.amountPaid).toFixed(2));
      const amountDue = parseFloat((calculatedTotal - amountPaid).toFixed(2));

      let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' = 'paid';
      if (amountDue <= 0.001) {
        paymentStatus = 'paid';
      } else if (amountPaid > 0.001) {
        paymentStatus = 'partially_paid';
      } else {
        paymentStatus = 'unpaid';
      }

      const purchaseBillRecord: Omit<PurchaseBill, 'id'> = {
        invoiceNumber: data.invoiceNumber?.trim() || undefined,
        supplierName: data.supplierName.trim(),
        supplierPhone: data.supplierPhone?.trim() || undefined,
        purchaseDate: data.purchaseDate,
        items: billItems,
        totalAmount: calculatedTotal,
        amountPaid,
        amountDue,
        paymentStatus,
        paymentMethod: data.paymentMethod,
        notes: data.notes?.trim() || undefined,
        createdAt: nowISO,
        updatedAt: nowISO,
        recordedByEmail: session.email,
        recordedByName: session.name,
      };

      transaction.set(billDocRef, purchaseBillRecord);

      // Write individual purchase logs
      for (const item of individualPurchaseDocRefs) {
        transaction.set(item.ref, item.data);
      }
    });

    invalidateMemoryCache('purchase_bills');
    invalidateMemoryCache('purchases');
    invalidateMemoryCache('products');
    revalidateTag('purchases');
    revalidateTag('products');
    revalidatePath('/purchases');
    revalidatePath('/dashboard');
    revalidatePath('/products');

    return {
      success: true,
      message: 'Purchase bill recorded and inventory stock updated successfully!',
      billId,
    };
  } catch (error) {
    console.error('Error recording purchase bill:', error);
    return {
      success: false,
      message: `Failed to record purchase bill: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function deletePurchaseBillAction(
  billId: string
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return { success: false, message: 'Unauthorized: Only store owners can delete purchase bills.' };
  }

  try {
    const billRef = doc(db, PURCHASE_BILLS_COLLECTION, billId);

    await runTransaction(db, async (transaction) => {
      const billSnap = await transaction.get(billRef);
      if (!billSnap.exists()) {
        throw new Error('Purchase bill not found.');
      }
      const billData = billSnap.data() as PurchaseBill;

      // Read products to rollback stock
      const productReads = await Promise.all(
        billData.items.map((item) => transaction.get(doc(db, PRODUCTS_COLLECTION, item.productId)))
      );

      // Rollback product stocks
      const nowISO = new Date().toISOString();
      for (let i = 0; i < billData.items.length; i++) {
        const item = billData.items[i];
        const prodSnap = productReads[i];
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() || {};
          const conversionFactor = item.conversionFactorSnapshot || prodData.purchaseUnitConversionFactor || 1;
          const quantityToRemove = item.quantityPurchased * conversionFactor;
          const newStock = Math.max(0, (prodData.quantityInStock || 0) - quantityToRemove);

          transaction.update(doc(db, PRODUCTS_COLLECTION, item.productId), {
            quantityInStock: newStock,
            updatedAt: nowISO,
            lastStockUpdateByEmail: session.email,
            lastStockUpdateByName: session.name,
          });
        }
      }

      // Delete the purchase bill document
      transaction.delete(billRef);
    });

    invalidateMemoryCache('purchase_bills');
    invalidateMemoryCache('purchases');
    invalidateMemoryCache('products');
    revalidateTag('purchases');
    revalidateTag('products');
    revalidatePath('/purchases');
    revalidatePath('/dashboard');
    revalidatePath('/products');

    return { success: true, message: 'Purchase bill deleted and inventory stock reversed.' };
  } catch (error) {
    console.error('Error deleting purchase bill:', error);
    return {
      success: false,
      message: `Failed to delete purchase bill: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
