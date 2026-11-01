'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, getDocs, doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSession } from '@/app/login/actions';
import type { InventoryAdjustment, RecordInventoryAdjustmentPayload } from '@/lib/types';

const PRODUCTS_COLLECTION = 'products';
const INVENTORY_ADJUSTMENTS_COLLECTION = 'inventory_adjustments';

function mapDocToAdjustment(document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): InventoryAdjustment {
  const data = document.data();
  if (!data) {
    throw new Error('Document data is undefined');
  }

  const nowAsISO = new Date().toISOString();

  return {
    id: document.id,
    productId: data.productId || '',
    productNameSnapshot: data.productNameSnapshot || 'Unknown Product',
    categorySnapshot: data.categorySnapshot || undefined,
    type: data.type || 'other',
    quantityAdjusted: typeof data.quantityAdjusted === 'number' ? data.quantityAdjusted : 0,
    unit: data.unit || 'piece',
    unitCostSnapshot: typeof data.unitCostSnapshot === 'number' ? data.unitCostSnapshot : 0,
    totalValueImpact: typeof data.totalValueImpact === 'number' ? data.totalValueImpact : 0,
    reason: data.reason || '',
    notes: data.notes || '',
    date: data.date || (data.createdAt ? data.createdAt.split('T')[0] : nowAsISO.split('T')[0]),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || nowAsISO),
    recordedByEmail: data.recordedByEmail || undefined,
    recordedByName: data.recordedByName || undefined,
  };
}

export async function recordInventoryAdjustmentAction(
  payload: RecordInventoryAdjustmentPayload
): Promise<{ success: boolean; message: string; adjustmentId?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in to adjust stock.' };
  }

  const { productId, type, quantityAdjusted, reason, notes, date } = payload;

  if (!productId) {
    return { success: false, message: 'Product is required.' };
  }

  if (quantityAdjusted === 0 || isNaN(quantityAdjusted)) {
    return { success: false, message: 'Adjustment quantity cannot be 0.' };
  }

  if (!reason || reason.trim() === '') {
    return { success: false, message: 'Reason is required for auditing purposes.' };
  }

  const productRef = doc(db, PRODUCTS_COLLECTION, productId);
  const now = Timestamp.now().toDate().toISOString();
  const adjustmentDate = date || now.split('T')[0];

  try {
    const adjustmentDocId = await runTransaction(db, async (transaction) => {
      // 1. READ: Product document
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) {
        throw new Error('Product not found in inventory.');
      }

      const productData = productSnap.data();
      const currentStock = typeof productData.quantityInStock === 'number' ? productData.quantityInStock : 0;
      const baseUnit = productData.baseUnit || 'piece';
      const productName = productData.name || 'Unknown Product';
      const category = productData.category;
      const unitCost = typeof productData.purchasePrice === 'number' ? productData.purchasePrice : 0;

      const newStock = parseFloat((currentStock + quantityAdjusted).toFixed(4));

      // Guard: Cannot deduct more than available in stock
      if (quantityAdjusted < 0 && Math.abs(quantityAdjusted) > currentStock + 0.0001) {
        throw new Error(
          `Cannot deduct ${Math.abs(quantityAdjusted)} ${baseUnit}. Current available stock is only ${currentStock} ${baseUnit}.`
        );
      }

      const totalValueImpact = parseFloat((quantityAdjusted * unitCost).toFixed(2));

      // 2. WRITE: Update product stock
      transaction.update(productRef, {
        quantityInStock: Math.max(0, newStock),
        updatedAt: now,
        lastStockUpdateByEmail: session.email,
        lastStockUpdateByName: session.name,
      });

      // 3. WRITE: Add inventory adjustment audit record
      const adjustmentsColRef = collection(db, INVENTORY_ADJUSTMENTS_COLLECTION);
      const newAdjustmentRef = doc(adjustmentsColRef);

      transaction.set(newAdjustmentRef, {
        productId,
        productNameSnapshot: productName,
        categorySnapshot: category,
        type,
        quantityAdjusted,
        unit: baseUnit,
        unitCostSnapshot: unitCost,
        totalValueImpact,
        reason: reason.trim(),
        notes: notes ? notes.trim() : '',
        date: adjustmentDate,
        createdAt: now,
        recordedByEmail: session.email,
        recordedByName: session.name,
      });

      return newAdjustmentRef.id;
    });

    revalidatePath('/products');
    revalidatePath('/products/adjustments');
    revalidatePath(`/products/${productId}`);
    revalidatePath('/dashboard');
    revalidatePath('/alerts');

    return {
      success: true,
      message: `Stock successfully adjusted (${quantityAdjusted > 0 ? '+' : ''}${quantityAdjusted}).`,
      adjustmentId: adjustmentDocId,
    };
  } catch (error) {
    console.error('Error recording inventory adjustment:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to adjust stock. Please try again.',
    };
  }
}

export async function getInventoryAdjustmentsAction(): Promise<InventoryAdjustment[]> {
  try {
    const colRef = collection(db, INVENTORY_ADJUSTMENTS_COLLECTION);
    const snap = await getDocs(colRef);

    const adjustments: InventoryAdjustment[] = [];
    snap.forEach((d) => {
      try {
        adjustments.push(mapDocToAdjustment(d));
      } catch (err) {
        console.warn(`Failed to parse adjustment document ${d.id}:`, err);
      }
    });

    // In-memory sort descending by createdAt / date
    adjustments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return adjustments;
  } catch (error) {
    console.error('Error fetching inventory adjustments:', error);
    return [];
  }
}

export async function deleteInventoryAdjustmentAction(
  adjustmentId: string
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: Please log in.' };
  }

  if (session.role !== 'owner') {
    return { success: false, message: 'Permission denied: Only store owners can delete adjustment records.' };
  }

  const adjustmentRef = doc(db, INVENTORY_ADJUSTMENTS_COLLECTION, adjustmentId);
  const now = Timestamp.now().toDate().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      // 1. READ adjustment
      const adjSnap = await transaction.get(adjustmentRef);
      if (!adjSnap.exists()) {
        throw new Error('Adjustment record not found.');
      }

      const adjData = adjSnap.data();
      const productId = adjData.productId;
      const quantityAdjusted = typeof adjData.quantityAdjusted === 'number' ? adjData.quantityAdjusted : 0;

      // 2. READ product
      const productRef = doc(db, PRODUCTS_COLLECTION, productId);
      const productSnap = await transaction.get(productRef);

      if (productSnap.exists()) {
        const prodData = productSnap.data();
        const currentStock = typeof prodData.quantityInStock === 'number' ? prodData.quantityInStock : 0;
        // Reverse adjustment: minus the adjusted quantity
        const restoredStock = parseFloat((currentStock - quantityAdjusted).toFixed(4));
        if (restoredStock < 0) {
          throw new Error('Cannot reverse this adjustment because it would result in negative current stock.');
        }

        transaction.update(productRef, {
          quantityInStock: restoredStock,
          updatedAt: now,
          lastStockUpdateByEmail: session.email,
          lastStockUpdateByName: session.name,
        });
      }

      // 3. DELETE adjustment doc
      transaction.delete(adjustmentRef);
    });

    revalidatePath('/products');
    revalidatePath('/products/adjustments');
    revalidatePath('/dashboard');

    return { success: true, message: 'Adjustment deleted and stock reversed.' };
  } catch (error) {
    console.error('Error deleting inventory adjustment:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete adjustment record.',
    };
  }
}
