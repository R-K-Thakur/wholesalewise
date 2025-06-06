
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, doc, runTransaction, Timestamp, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RecordSaleActionPayload } from './schema';
import type { Product, Sale, SaleItem, PaymentTransaction } from '@/lib/types';
import type { ProductUnit } from '@/lib/constants';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';

// Helper function to convert Firestore doc data to Sale
const mapDocToSale = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Sale => {
  const data = document.data();
  if (!data) {
    throw new Error('Sale document data is undefined.');
  }
  const nowAsISO = new Date().toISOString();

  const paymentHistory: PaymentTransaction[] = Array.isArray(data.paymentHistory) ? data.paymentHistory.map((ph: any) => ({
    date: typeof ph.date === 'string' ? ph.date : (ph.date?.toDate ? ph.date.toDate().toISOString() : nowAsISO),
    amount: typeof ph.amount === 'number' ? ph.amount : 0,
    paymentMethod: ['cash', 'card', 'online'].includes(ph.paymentMethod) ? ph.paymentMethod as Sale['paymentMethod'] : undefined,
    notes: typeof ph.notes === 'string' ? ph.notes : undefined,
  })) : [];


  return {
    id: document.id,
    items: Array.isArray(data.items) ? data.items.map((item: any): SaleItem => ({
      productId: typeof item.productId === 'string' ? item.productId : '',
      productNameSnapshot: typeof item.productNameSnapshot === 'string' ? item.productNameSnapshot : '',
      quantitySold: typeof item.quantitySold === 'number' ? item.quantitySold : 0,
      pricePerUnitSold: typeof item.pricePerUnitSold === 'number' ? item.pricePerUnitSold : 0,
      soldUnit: typeof item.soldUnit === 'string' ? item.soldUnit as ProductUnit : 'piece',
      baseUnitSnapshot: typeof item.baseUnitSnapshot === 'string' ? item.baseUnitSnapshot as ProductUnit : 'piece',
      total: typeof item.total === 'number' ? item.total : 0,
    })) : [],
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
    totalPaidAmount: typeof data.totalPaidAmount === 'number' ? data.totalPaidAmount : 0,
    totalAmountDue: typeof data.totalAmountDue === 'number' ? data.totalAmountDue : 0,
    paymentStatus: ['paid', 'partially_paid', 'unpaid'].includes(data.paymentStatus) ? data.paymentStatus : 'unpaid',
    paymentHistory: paymentHistory,
    saleType: ['wholesale', 'retail'].includes(data.saleType) ? data.saleType : 'retail',
    saleDate: typeof data.saleDate === 'string' ? data.saleDate : nowAsISO,
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    paymentMethod: ['cash', 'card', 'online'].includes(data.paymentMethod) ? data.paymentMethod as Sale['paymentMethod'] : undefined,
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : nowAsISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (typeof data.updatedAt === 'string' ? data.updatedAt : nowAsISO),
  };
};

export async function recordSaleAction(data: RecordSaleActionPayload) {
  console.log('Recording sale with data:', JSON.stringify(data, null, 2));
  try {
    await runTransaction(db, async (transaction) => {
      const saleItemsForDb: SaleItem[] = [];
      let calculatedBillTotalAmount = 0; // This is the total for all items in the bill

      for (const item of data.items) {
        if (!item.productId) {
          throw new Error(`Missing productId for item: ${item.productNameSnapshot}`);
        }
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error(`Product "${item.productNameSnapshot}" (ID: ${item.productId}) not found.`);
        }

        const product = productSnap.data() as Omit<Product, 'id'>;

        let quantitySoldInBaseUnits = item.quantitySold;
        if (item.soldUnit === product.purchaseUnit && product.baseUnit !== product.purchaseUnit) {
          quantitySoldInBaseUnits = item.quantitySold * (product.purchaseUnitConversionFactor || 1);
        }

        if (product.quantityInStock < quantitySoldInBaseUnits) {
          throw new Error(
            `Insufficient stock for "${item.productNameSnapshot}". Available (base units): ${product.quantityInStock}, Requested (base units): ${quantitySoldInBaseUnits}.`
          );
        }

        const newStock = product.quantityInStock - quantitySoldInBaseUnits;
        transaction.update(productRef, { quantityInStock: newStock, updatedAt: Timestamp.now().toDate().toISOString() });

        saleItemsForDb.push({
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantitySold: item.quantitySold,
          pricePerUnitSold: item.pricePerUnitSold,
          soldUnit: item.soldUnit,
          baseUnitSnapshot: item.baseUnitSnapshot,
          total: item.quantitySold * item.pricePerUnitSold,
        });
        calculatedBillTotalAmount += item.quantitySold * item.pricePerUnitSold;
      }

      if (Math.abs(calculatedBillTotalAmount - data.totalAmount) > 0.001) {
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${calculatedBillTotalAmount}. Using server calculated item total.`);
      }
      if (data.amountPaid > calculatedBillTotalAmount) {
        throw new Error("Amount paid cannot be greater than the total bill amount.");
      }


      const now = Timestamp.now().toDate().toISOString();
      const totalPaidAmountForSale = data.amountPaid;
      const totalAmountDueForSale = calculatedBillTotalAmount - totalPaidAmountForSale;

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= 0) {
        paymentStatus = 'paid';
      } else if (totalPaidAmountForSale > 0 && totalAmountDueForSale > 0) {
        paymentStatus = 'partially_paid';
      } else if (totalPaidAmountForSale === 0 && calculatedBillTotalAmount > 0) {
        paymentStatus = 'unpaid';
      }


      const initialPayment: PaymentTransaction = {
        date: now, // Or use data.saleDate if preferred for the first payment record
        amount: data.amountPaid,
        paymentMethod: data.paymentMethod,
        // notes for this specific payment transaction could be added if form supports it
      };

      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate,
        saleType: data.saleType,
        paymentMethod: data.paymentMethod, // Main payment method for the sale
        items: saleItemsForDb,
        totalAmount: calculatedBillTotalAmount, // Grand total of the bill
        totalPaidAmount: totalPaidAmountForSale,
        totalAmountDue: totalAmountDueForSale,
        paymentStatus: paymentStatus,
        paymentHistory: [initialPayment],
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(doc(collection(db, SALES_COLLECTION)), newSaleData);
    });

    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/dashboard');

    return { success: true, message: 'Sale recorded successfully!' };
  } catch (error) {
    console.error("Error recording sale:", error);
    return { success: false, message: `Failed to record sale: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function getSalesAction(): Promise<Sale[]> {
  try {
    const q = query(collection(db, SALES_COLLECTION), orderBy("saleDate", "desc"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const sales = querySnapshot.docs.map(mapDocToSale);
    return sales;
  } catch (error) {
    console.error("Error fetching sales from Firestore:", error);
    return [];
  }
}

export async function getSaleByIdAction(id: string): Promise<Sale | undefined> {
  try {
    const docRef = doc(db, SALES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToSale(docSnap);
    } else {
      console.log("No such sale document!");
      return undefined;
    }
  } catch (error) {
    console.error("Error fetching sale by ID from Firestore:", error);
    return undefined;
  }
}
