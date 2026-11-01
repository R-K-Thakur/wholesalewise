'use server';

import { revalidatePath } from 'next/cache';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSession } from '@/app/login/actions';
import type { SaleReturn, RecordSaleReturnPayload, Sale, Product, Customer } from '@/lib/types';

const SALES_COLLECTION = 'sales';
const SALE_RETURNS_COLLECTION = 'sale_returns';
const PRODUCTS_COLLECTION = 'products';
const CUSTOMERS_COLLECTION = 'customers';
const INVENTORY_ADJUSTMENTS_COLLECTION = 'inventory_adjustments';

function mapDocToSaleReturn(document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): SaleReturn {
  const data = document.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }

  const nowAsISO = new Date().toISOString();

  return {
    id: document.id,
    returnNumber: data.returnNumber || `SR-${document.id.slice(0, 6).toUpperCase()}`,
    saleId: data.saleId || '',
    customerId: data.customerId || undefined,
    customerName: data.customerName || undefined,
    customerPhone: data.customerPhone || undefined,
    items: Array.isArray(data.items)
      ? data.items.map((i: any) => ({
          productId: i.productId || undefined,
          productNameSnapshot: i.productNameSnapshot || 'Unknown Item',
          quantityReturned: typeof i.quantityReturned === 'number' ? i.quantityReturned : 0,
          unit: i.unit || 'piece',
          pricePerUnit: typeof i.pricePerUnit === 'number' ? i.pricePerUnit : 0,
          totalRefund: typeof i.totalRefund === 'number' ? i.totalRefund : 0,
          condition: i.condition === 'damaged' ? 'damaged' : 'resellable',
        }))
      : [],
    totalReturnAmount: typeof data.totalReturnAmount === 'number' ? data.totalReturnAmount : 0,
    refundMethod: data.refundMethod || 'cash',
    returnReason: data.returnReason || '',
    notes: data.notes || '',
    returnDate: data.returnDate || (data.createdAt ? data.createdAt.split('T')[0] : nowAsISO.split('T')[0]),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || nowAsISO),
    recordedByEmail: data.recordedByEmail || undefined,
    recordedByName: data.recordedByName || undefined,
  };
}

export async function recordSaleReturnAction(
  payload: RecordSaleReturnPayload
): Promise<{ success: boolean; message: string; returnId?: string; returnNumber?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in to process returns.' };
  }

  const { saleId, items, refundMethod, returnReason, notes, returnDate } = payload;

  if (!saleId) {
    return { success: false, message: 'Original Sale Invoice ID is required.' };
  }

  if (!items || items.length === 0) {
    return { success: false, message: 'At least one item must be returned.' };
  }

  // Pre-fetch previous returns for this sale to compute remaining returnable limits
  let previousReturns: SaleReturn[] = [];
  try {
    const q = query(collection(db, SALE_RETURNS_COLLECTION), where('saleId', '==', saleId));
    const prevSnap = await getDocs(q);
    prevSnap.forEach((d) => {
      try {
        previousReturns.push(mapDocToSaleReturn(d));
      } catch (err) {
        // ignore malformed
      }
    });
  } catch (err) {
    console.warn('Could not query previous returns prior to transaction:', err);
  }

  const now = Timestamp.now().toDate().toISOString();
  const returnDateStr = returnDate || now.split('T')[0];
  const returnNumber = `SR-${Date.now().toString().slice(-6)}`;

  const saleRef = doc(db, SALES_COLLECTION, saleId);

  try {
    const newReturnId = await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST:
      // Read original sale
      const saleSnap = await transaction.get(saleRef);
      if (!saleSnap.exists()) {
        throw new Error('Original sale invoice not found.');
      }
      const saleData = saleSnap.data();

      // Read customer if exists
      let customerRef: any = null;
      let customerSnap: any = null;
      if (saleData.customerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, saleData.customerId);
        customerSnap = await transaction.get(customerRef);
      }

      // Read product docs for all items with a valid productId
      const productDocsMap = new Map<string, any>();
      for (const item of items) {
        if (item.productId && !productDocsMap.has(item.productId)) {
          const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            productDocsMap.set(item.productId, { ref: prodRef, data: prodSnap.data() });
          }
        }
      }

      // 2. VALIDATE QUANTITIES:
      // Map original quantities sold
      const originalItemQuantities = new Map<string, number>();
      for (const origItem of saleData.items || []) {
        const key = origItem.productId || origItem.productNameSnapshot;
        originalItemQuantities.set(key, (originalItemQuantities.get(key) || 0) + (origItem.quantitySold || 0));
      }

      // Map already returned quantities
      const alreadyReturnedQuantities = new Map<string, number>();
      for (const prev of previousReturns) {
        for (const prevItem of prev.items) {
          const key = prevItem.productId || prevItem.productNameSnapshot;
          alreadyReturnedQuantities.set(
            key,
            (alreadyReturnedQuantities.get(key) || 0) + prevItem.quantityReturned
          );
        }
      }

      // Check current return quantities
      for (const returnItem of items) {
        const key = returnItem.productId || returnItem.productNameSnapshot;
        const totalSold = originalItemQuantities.get(key) || 0;
        const alreadyReturned = alreadyReturnedQuantities.get(key) || 0;
        const remainingReturnable = parseFloat((totalSold - alreadyReturned).toFixed(4));

        if (returnItem.quantityReturned > remainingReturnable + 0.0001) {
          throw new Error(
            `Cannot return ${returnItem.quantityReturned} of "${returnItem.productNameSnapshot}". Only ${remainingReturnable} remaining returnable.`
          );
        }
      }

      // 3. COMPUTE TOTALS & PROCESS ITEMS:
      let computedTotalReturn = 0;
      const processedItems = items.map((i) => {
        const itemRefund = parseFloat((i.quantityReturned * i.pricePerUnit).toFixed(2));
        computedTotalReturn += itemRefund;
        return {
          productId: i.productId || undefined,
          productNameSnapshot: i.productNameSnapshot,
          quantityReturned: i.quantityReturned,
          unit: i.unit,
          pricePerUnit: i.pricePerUnit,
          totalRefund: itemRefund,
          condition: i.condition,
        };
      });
      computedTotalReturn = parseFloat(computedTotalReturn.toFixed(2));

      // 4. WRITES:
      // A. Restock resellable products
      for (const item of processedItems) {
        if (item.productId && productDocsMap.has(item.productId)) {
          const prodInfo = productDocsMap.get(item.productId);
          if (item.condition === 'resellable') {
            const currentStock = typeof prodInfo.data.quantityInStock === 'number' ? prodInfo.data.quantityInStock : 0;
            const newStock = parseFloat((currentStock + item.quantityReturned).toFixed(4));

            transaction.update(prodInfo.ref, {
              quantityInStock: newStock,
              updatedAt: now,
              lastStockUpdateByEmail: session.email,
              lastStockUpdateByName: session.name,
            });
          } else {
            // Damaged item: log waste adjustment
            const adjRef = doc(collection(db, INVENTORY_ADJUSTMENTS_COLLECTION));
            const cost = typeof prodInfo.data.purchasePrice === 'number' ? prodInfo.data.purchasePrice : 0;
            transaction.set(adjRef, {
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              categorySnapshot: prodInfo.data.category,
              type: 'damage',
              quantityAdjusted: -item.quantityReturned,
              unit: item.unit,
              unitCostSnapshot: cost,
              totalValueImpact: -parseFloat((item.quantityReturned * cost).toFixed(2)),
              reason: `Customer Return #${returnNumber} (Damaged upon return: ${returnReason})`,
              notes: notes || '',
              date: returnDateStr,
              createdAt: now,
              recordedByEmail: session.email,
              recordedByName: session.name,
            });
          }
        }
      }

      // B. Update Customer Balance if refundMethod === 'deduct_customer_due'
      if (refundMethod === 'deduct_customer_due' && customerRef && customerSnap && customerSnap.exists()) {
        const custData = customerSnap.data();
        const currentDue = Number(custData.totalDue) || 0;
        const newDue = parseFloat(Math.max(0, currentDue - computedTotalReturn).toFixed(2));

        transaction.update(customerRef, {
          totalDue: newDue,
          updatedAt: now,
        });

        const custTxRef = doc(collection(db, CUSTOMERS_COLLECTION, saleData.customerId, 'transactions'));
        transaction.set(custTxRef, {
          customerId: saleData.customerId,
          type: 'adjustment',
          saleId: saleId,
          amount: computedTotalReturn,
          dueAdded: -computedTotalReturn,
          balanceAfter: newDue,
          paymentMethod: 'manual_adjustment',
          date: returnDateStr,
          notes: `Credit Note #${returnNumber} for Invoice #${saleId} (Return: ${returnReason})`,
          createdAt: now,
          recordedByEmail: session.email,
          recordedByName: session.name,
        });
      }

      // C. Adjust original sale due amount if applicable
      const currentSaleDue = typeof saleData.totalAmountDue === 'number' ? saleData.totalAmountDue : 0;
      if (currentSaleDue > 0 && refundMethod === 'deduct_customer_due') {
        const newSaleDue = parseFloat(Math.max(0, currentSaleDue - computedTotalReturn).toFixed(2));
        transaction.update(saleRef, {
          totalAmountDue: newSaleDue,
          paymentStatus: newSaleDue <= 0.001 ? 'paid' : saleData.paymentStatus,
          updatedAt: now,
        });
      }

      // D. Insert sale_returns record
      const returnDocRef = doc(collection(db, SALE_RETURNS_COLLECTION));
      transaction.set(returnDocRef, {
        returnNumber,
        saleId,
        customerId: saleData.customerId || undefined,
        customerName: saleData.customerName || undefined,
        customerPhone: saleData.customerPhone || undefined,
        items: processedItems,
        totalReturnAmount: computedTotalReturn,
        refundMethod,
        returnReason: returnReason.trim(),
        notes: notes ? notes.trim() : '',
        returnDate: returnDateStr,
        createdAt: now,
        recordedByEmail: session.email,
        recordedByName: session.name,
      });

      return returnDocRef.id;
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/sales/returns');
    if (payload.saleId) revalidatePath(`/sales/returns/${newReturnId}`);
    revalidatePath('/customers');
    revalidatePath('/products');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Return recorded successfully (${returnNumber}).`,
      returnId: newReturnId,
      returnNumber,
    };
  } catch (error) {
    console.error('Error recording sale return:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to record return. Please try again.',
    };
  }
}

export async function getSaleReturnsAction(): Promise<SaleReturn[]> {
  try {
    const colRef = collection(db, SALE_RETURNS_COLLECTION);
    const snap = await getDocs(colRef);

    const returns: SaleReturn[] = [];
    snap.forEach((d) => {
      try {
        returns.push(mapDocToSaleReturn(d));
      } catch (err) {
        console.warn(`Failed to parse return document ${d.id}:`, err);
      }
    });

    returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return returns;
  } catch (error) {
    console.error('Error fetching sale returns:', error);
    return [];
  }
}

export async function getSaleReturnByIdAction(id: string): Promise<SaleReturn | null> {
  try {
    const docRef = doc(db, SALE_RETURNS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return mapDocToSaleReturn(snap);
  } catch (error) {
    console.error(`Error fetching sale return ${id}:`, error);
    return null;
  }
}

export async function getSaleReturnsForSaleAction(saleId: string): Promise<SaleReturn[]> {
  try {
    const q = query(collection(db, SALE_RETURNS_COLLECTION), where('saleId', '==', saleId));
    const snap = await getDocs(q);

    const returns: SaleReturn[] = [];
    snap.forEach((d) => {
      try {
        returns.push(mapDocToSaleReturn(d));
      } catch (err) {
        console.warn(`Failed to parse return document for sale ${saleId}:`, err);
      }
    });

    returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return returns;
  } catch (error) {
    console.error(`Error fetching returns for sale ${saleId}:`, error);
    return [];
  }
}
