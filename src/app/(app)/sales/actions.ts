
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RecordSaleActionPayload } from './schema';
import type { Product, Sale, SaleItem } from '@/lib/types';
import { getProductByIdAction } from '../products/actions'; // To fetch product details for stock update

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';

export async function recordSaleAction(data: RecordSaleActionPayload) {
  console.log('Recording sale with data:', JSON.stringify(data, null, 2));
  try {
    await runTransaction(db, async (transaction) => {
      const saleItemsForDb: SaleItem[] = [];
      let calculatedTotalAmount = 0;

      // First, validate stock and prepare product updates
      for (const item of data.items) {
        if (!item.productId) {
          throw new Error(`Missing productId for item: ${item.productNameSnapshot}`);
        }
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Product "${item.productNameSnapshot}" (ID: ${item.productId}) not found.`);
        }

        const product = productSnap.data() as Omit<Product, 'id'>; // Assuming Product type structure

        if (product.quantityInStock < item.quantitySold) {
          throw new Error(
            `Insufficient stock for "${item.productNameSnapshot}". Available: ${product.quantityInStock}, Requested: ${item.quantitySold}.`
          );
        }

        const newStock = product.quantityInStock - item.quantitySold;
        transaction.update(productRef, { quantityInStock: newStock, updatedAt: Timestamp.now().toDate().toISOString() });
        
        saleItemsForDb.push({
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantitySold: item.quantitySold,
          pricePerUnitSold: item.pricePerUnitSold,
          unitSnapshot: item.unitSnapshot,
          total: item.quantitySold * item.pricePerUnitSold,
        });
        calculatedTotalAmount += item.quantitySold * item.pricePerUnitSold;
      }
      
      // Verify calculated total amount matches the one passed if necessary, or use the calculated one.
      // For robustness, we'll use the server-calculated total.
      if (Math.abs(calculatedTotalAmount - data.totalAmount) > 0.001) {
         console.warn(`Total amount discrepancy. Client: ${data.totalAmount}, Server calculated: ${calculatedTotalAmount}. Using server calculated.`);
      }


      const now = Timestamp.now().toDate().toISOString();
      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate, // Already an ISO string from form
        saleType: data.saleType,
        paymentMethod: data.paymentMethod,
        items: saleItemsForDb,
        totalAmount: calculatedTotalAmount, // Use server-calculated total
        notes: '', // Assuming notes field is not yet in SaleFormData, add if needed
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(doc(collection(db, SALES_COLLECTION)), newSaleData);
    });

    revalidatePath('/sales');
    revalidatePath('/products'); // Stock levels changed
    revalidatePath('/dashboard'); // Dashboard data might depend on sales/stock
    // Potentially revalidate individual product pages if they show stock, but that's more granular.

    return { success: true, message: 'Sale recorded successfully!' };
  } catch (error) {
    console.error("Error recording sale:", error);
    return { success: false, message: `Failed to record sale: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Action to fetch sales (can be implemented later if needed for sales list page)
// export async function getSalesAction(): Promise<Sale[]> { ... }
// Action to fetch a specific sale (can be implemented later)
// export async function getSaleByIdAction(id: string): Promise<Sale | undefined> { ... }
