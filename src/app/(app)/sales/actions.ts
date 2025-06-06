
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
    paymentStatus: ['paid', 'partially_paid', 'unpaid'].includes(data.paymentStatus) ? data.paymentStatus : 'unpaid',
    paymentHistory: paymentHistory,
    saleType: ['wholesale', 'retail'].includes(data.saleType) ? data.saleType : 'retail',
    saleDate: typeof data.saleDate === 'string' ? data.saleDate : nowAsISO,
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(data.paymentMethod) ? data.paymentMethod as Sale['paymentMethod'] | 'manual_adjustment' : undefined,
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
      data.amountPaid = parseFloat(data.amountPaid.toFixed(2));


      if (Math.abs(calculatedBillTotalAmount - data.totalAmount) > 0.01) { // Use a small epsilon for float comparison
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${calculatedBillTotalAmount}. Using server calculated item total.`);
      }
      if (data.amountPaid > calculatedBillTotalAmount) {
        throw new Error(`Amount paid (Rs. ${data.amountPaid}) cannot be greater than the total bill amount (Rs. ${calculatedBillTotalAmount}).`);
      }


      const now = Timestamp.now().toDate().toISOString();
      const totalPaidAmountForSale = data.amountPaid;
      const totalAmountDueForSale = calculatedBillTotalAmount - totalPaidAmountForSale;

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= 0.001) { // Use epsilon for $0 due check
        paymentStatus = 'paid';
      } else if (totalPaidAmountForSale > 0 && totalAmountDueForSale > 0.001) {
        paymentStatus = 'partially_paid';
      } else if (totalPaidAmountForSale <= 0.001 && calculatedBillTotalAmount > 0) { // If amount paid is effectively zero
        paymentStatus = 'unpaid';
      }


      const initialPayment: PaymentTransaction = {
        date: now,
        amount: data.amountPaid,
        paymentMethod: data.paymentMethod,
      };
      
      const paymentHistory = data.amountPaid > 0 ? [initialPayment] : [];


      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate,
        saleType: data.saleType,
        paymentMethod: data.paymentMethod,
        items: saleItemsForDb,
        totalAmount: calculatedBillTotalAmount,
        totalPaidAmount: totalPaidAmountForSale,
        totalAmountDue: parseFloat(totalAmountDueForSale.toFixed(2)),
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
  // Fields from the sale needed for logic if changing to 'paid' or 'unpaid'
  currentTotalAmount: number; 
  // currentTotalPaidAmount: number; // Not strictly needed as we override based on new status
  // currentPaymentMethod?: Sale['paymentMethod']; // Not strictly needed for this version
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
      const saleData = saleDoc.data() as Sale;

      const updateData: Partial<Sale> = {
        paymentStatus: newStatus,
        updatedAt: now,
      };
      let paymentHistoryEntry: PaymentTransaction | null = null;

      if (newStatus === 'paid') {
        const amountToMakePaid = parseFloat((currentTotalAmount - saleData.totalPaidAmount).toFixed(2));
        updateData.totalPaidAmount = parseFloat(currentTotalAmount.toFixed(2));
        updateData.totalAmountDue = 0;
        if (amountToMakePaid >= 0) { // Only add if there was actually something due or it was already paid
             paymentHistoryEntry = {
                date: now,
                amount: amountToMakePaid,
                paymentMethod: 'manual_adjustment',
                notes: `Status manually changed to 'Paid' by ${session.email}.`,
            };
        } else if (amountToMakePaid < 0) { // If it was overpaid and marked as paid
             paymentHistoryEntry = {
                date: now,
                amount: 0, // No financial change, just status
                paymentMethod: 'manual_adjustment',
                notes: `Status manually changed to 'Paid' by ${session.email}. (Original total paid: ${saleData.totalPaidAmount})`,
            };
        }

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = parseFloat(currentTotalAmount.toFixed(2));
        paymentHistoryEntry = {
          date: now,
          amount: 0, // No financial change, reflects all previous payments are now considered 'unpaid' status-wise
          paymentMethod: 'manual_adjustment',
          notes: `Status manually changed to 'Unpaid' by ${session.email}. Previously paid Rs. ${saleData.totalPaidAmount} is now considered void for status purposes.`,
        };
      } else if (newStatus === 'partially_paid') {
        // For 'partially_paid', we only update the status string.
        // Financial figures (totalPaidAmount, totalAmountDue) should be updated
        // via a separate "Record Payment" action.
        // If current totalPaidAmount is 0 and totalAmount > 0, this is correct.
        // If current totalPaidAmount is > 0 and < totalAmount, this is correct.
        // If it was 'paid' and owner changes to 'partially_paid', it implies a correction.
        // The owner should then adjust payments. We won't change amounts here.
        if (saleData.totalPaidAmount >= saleData.totalAmount) { // Was paid, now marked partially
           paymentHistoryEntry = {
             date: now,
             amount: 0,
             paymentMethod: 'manual_adjustment',
             notes: `Status manually changed to 'Partially Paid' from 'Paid' by ${session.email}. Financials may need adjustment.`,
           };
        } else if (saleData.totalPaidAmount <= 0 && saleData.totalAmount > 0) { // Was unpaid, now marked partially
            paymentHistoryEntry = {
             date: now,
             amount: 0,
             paymentMethod: 'manual_adjustment',
             notes: `Status manually changed to 'Partially Paid' from 'Unpaid' by ${session.email}. Record payment to update financials.`,
           };
        }
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

    
