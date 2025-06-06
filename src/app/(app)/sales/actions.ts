
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, doc, runTransaction, Timestamp, getDocs, query, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RecordSaleActionPayload } from './schema';
import type { Product, Sale, SaleItem, PaymentTransaction } from '@/lib/types';
import type { ProductUnit } from '@/lib/constants';
import { getSession } from '@/app/login/actions';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';

const mapDocToSale = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Sale => {
  const data = document.data();
  if (!data) {
    throw new Error('Sale document data is undefined.');
  }
  const nowAsISO = new Date().toISOString();

  const paymentHistory: PaymentTransaction[] = Array.isArray(data.paymentHistory) ? data.paymentHistory.map((ph: any) => ({
    date: typeof ph.date === 'string' ? ph.date : (ph.date?.toDate ? ph.date.toDate().toISOString() : nowAsISO),
    amount: typeof ph.amount === 'number' ? ph.amount : 0,
    paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(ph.paymentMethod) ? ph.paymentMethod as Sale['paymentMethod'] | 'manual_adjustment' : undefined,
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
    paymentStatus: ['paid', 'partially_paid', 'unpaid'].includes(data.paymentStatus) ? data.paymentStatus as Sale['paymentStatus'] : 'unpaid',
    paymentHistory: paymentHistory,
    saleType: ['wholesale', 'retail'].includes(data.saleType) ? data.saleType as Sale['saleType'] : 'retail',
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
      let calculatedBillTotalAmount = 0; 

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
      
      calculatedBillTotalAmount = parseFloat(calculatedBillTotalAmount.toFixed(2));
      const amountPaidThisTransaction = parseFloat(data.amountPaid.toFixed(2));


      if (Math.abs(calculatedBillTotalAmount - data.totalAmount) > 0.01) {
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${calculatedBillTotalAmount}. Using server calculated item total.`);
      }
      if (amountPaidThisTransaction > calculatedBillTotalAmount) {
        throw new Error(`Amount paid (Rs. ${amountPaidThisTransaction}) cannot be greater than the total bill amount (Rs. ${calculatedBillTotalAmount}).`);
      }

      const now = Timestamp.now().toDate().toISOString();
      const totalAmountDueForSale = parseFloat((calculatedBillTotalAmount - amountPaidThisTransaction).toFixed(2));

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= 0.001) { 
        paymentStatus = 'paid';
      } else if (amountPaidThisTransaction > 0.001 && totalAmountDueForSale > 0.001) {
        paymentStatus = 'partially_paid';
      }

      const paymentHistory: PaymentTransaction[] = [];
      if (amountPaidThisTransaction > 0.001) {
        paymentHistory.push({
          date: now,
          amount: amountPaidThisTransaction,
          paymentMethod: data.paymentMethod, // This is the method for the current payment
        });
      }
      
      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate,
        saleType: data.saleType,
        paymentMethod: data.paymentMethod, // Method of this initial transaction
        items: saleItemsForDb,
        totalAmount: calculatedBillTotalAmount,
        totalPaidAmount: amountPaidThisTransaction,
        totalAmountDue: totalAmountDueForSale,
        paymentStatus: paymentStatus,
        paymentHistory: paymentHistory,
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

interface UpdateSaleStatusPayload {
  saleId: string;
  newStatus: Sale['paymentStatus'];
  currentTotalAmount: number; // Total bill amount
}

export async function updateSalePaymentStatusAction(
  payload: UpdateSaleStatusPayload
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return { success: false, message: 'Unauthorized: Only owners can change sale status.' };
  }

  const { saleId, newStatus, currentTotalAmount } = payload;
  const saleRef = doc(db, SALES_COLLECTION, saleId);
  const now = Timestamp.now().toDate().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Sale not found.');
      }
      const saleData = saleDoc.data() as Sale; // Cast to Sale; already mapped by getSaleByIdAction

      const updateData: { [key: string]: any } = { // Use a more generic type for updateData
        paymentStatus: newStatus,
        updatedAt: now,
      };
      let paymentHistoryEntry: PaymentTransaction | null = null;
      const currentSaleTotalAmount = parseFloat(currentTotalAmount.toFixed(2));


      if (newStatus === 'paid') {
        const amountNeededToMakePaid = parseFloat((currentSaleTotalAmount - saleData.totalPaidAmount).toFixed(2));
        updateData.totalPaidAmount = currentSaleTotalAmount;
        updateData.totalAmountDue = 0;
        
        let paymentAmountForHistory = amountNeededToMakePaid;
        let notesForHistory = `Status manually changed to 'Paid' by ${session.email}.`;
        if (amountNeededToMakePaid < 0) { // If it was overpaid and now marked 'paid'
            notesForHistory += ` Original total paid Rs. ${saleData.totalPaidAmount}. Amount adjusted to Rs. ${currentSaleTotalAmount}.`;
            paymentAmountForHistory = 0; // No new "payment" amount, just status and financial re-alignment
        } else if (amountNeededToMakePaid === 0 && saleData.totalPaidAmount === currentSaleTotalAmount) {
            // Already paid, status just re-confirmed
            notesForHistory += ` Status confirmed as 'Paid'.`;
             paymentAmountForHistory = 0;
        } else {
            notesForHistory += ` Payment of Rs. ${amountNeededToMakePaid.toFixed(2)} recorded.`;
        }


        paymentHistoryEntry = {
            date: now,
            amount: paymentAmountForHistory,
            paymentMethod: 'manual_adjustment',
            notes: notesForHistory,
        };

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = currentSaleTotalAmount;
        paymentHistoryEntry = {
          date: now,
          amount: 0, 
          paymentMethod: 'manual_adjustment',
          notes: `Status manually changed to 'Unpaid' by ${session.email}. Original paid amount Rs. ${saleData.totalPaidAmount} is now voided for status purposes.`,
        };
      } else if (newStatus === 'partially_paid') {
        // If status changes to 'partially_paid', we don't automatically change financial figures.
        // We assume the current totalPaidAmount is correct for the 'partially_paid' state,
        // or the owner will make a separate payment adjustment.
        // We just log that the status was changed.
        if (saleData.paymentStatus === 'paid') {
            paymentHistoryEntry = {
                date: now,
                amount: 0, 
                paymentMethod: 'manual_adjustment',
                notes: `Status manually changed from 'Paid' to 'Partially Paid' by ${session.email}. Financials (paid amount Rs. ${saleData.totalPaidAmount}) may need separate adjustment if this implies a refund.`,
            };
        } else if (saleData.paymentStatus === 'unpaid' && saleData.totalPaidAmount > 0) {
             paymentHistoryEntry = {
                date: now,
                amount: 0,
                paymentMethod: 'manual_adjustment',
                notes: `Status manually changed from 'Unpaid' to 'Partially Paid' by ${session.email}. Current paid amount is Rs. ${saleData.totalPaidAmount}.`,
            };
        } else if (saleData.paymentStatus === 'unpaid' && saleData.totalPaidAmount <= 0.001) {
            paymentHistoryEntry = {
                date: now,
                amount: 0,
                paymentMethod: 'manual_adjustment',
                notes: `Status manually changed from 'Unpaid' to 'Partially Paid' by ${session.email}. Record a payment to update financials.`,
            };
        }
         // If already partially_paid, and owner re-selects partially_paid, no automatic history entry.
         // Important: totalPaidAmount and totalAmountDue are NOT changed here.
         // They should reflect the actual sum of payments.
         updateData.totalPaidAmount = saleData.totalPaidAmount;
         updateData.totalAmountDue = parseFloat((currentSaleTotalAmount - saleData.totalPaidAmount).toFixed(2));
      }

      if (paymentHistoryEntry) {
        updateData.paymentHistory = [...(saleData.paymentHistory || []), paymentHistoryEntry];
      }
      
      transaction.update(saleRef, updateData);
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: `Sale status successfully updated to ${newStatus}.` };

  } catch (error) {
    console.error('Error updating sale status:', error);
    return { success: false, message: `Failed to update sale status: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
