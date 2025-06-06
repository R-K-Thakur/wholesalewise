
'use server';

import { revalidatePath } from 'next/cache';
import { collection, addDoc, doc, runTransaction, Timestamp, getDocs, query, orderBy, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RecordSaleActionPayload } from './schema';
import type { Product, Sale, SaleItem, PaymentTransaction, RecordAdditionalPaymentPayload } from '@/lib/types';
import type { ProductUnit } from '@/lib/constants';
import { getSession } from '@/app/login/actions';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';
const EPSILON = 0.001; // For floating point comparisons

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
    recordedByEmail: typeof ph.recordedByEmail === 'string' ? ph.recordedByEmail : undefined,
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
    recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
  };
};

export async function recordSaleAction(data: RecordSaleActionPayload) {
  console.log('Recording sale with data:', JSON.stringify(data, null, 2));
  const session = await getSession();
  const userEmail = session?.email || 'system_sale_creation';

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
        transaction.update(productRef, { quantityInStock: newStock, updatedAt: Timestamp.now().toDate().toISOString(), lastStockUpdateByEmail: userEmail });

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


      if (Math.abs(calculatedBillTotalAmount - data.totalAmount) > EPSILON) {
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${calculatedBillTotalAmount}. Using server calculated item total.`);
      }
      if (amountPaidThisTransaction > calculatedBillTotalAmount + EPSILON) {
        throw new Error(`Amount paid (Rs. ${amountPaidThisTransaction}) cannot be greater than the total bill amount (Rs. ${calculatedBillTotalAmount}).`);
      }

      const now = Timestamp.now().toDate().toISOString();
      const totalAmountDueForSale = parseFloat((calculatedBillTotalAmount - amountPaidThisTransaction).toFixed(2));

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= EPSILON) { 
        paymentStatus = 'paid';
      } else if (amountPaidThisTransaction > EPSILON && totalAmountDueForSale > EPSILON) {
        paymentStatus = 'partially_paid';
      } else if (amountPaidThisTransaction <= EPSILON && calculatedBillTotalAmount > EPSILON) { // If amountPaid is 0 (or effectively 0) and bill has a total
        paymentStatus = 'unpaid';
      }

      const paymentHistory: PaymentTransaction[] = [];
      if (amountPaidThisTransaction > EPSILON) {
        paymentHistory.push({
          date: now,
          amount: amountPaidThisTransaction,
          paymentMethod: data.paymentMethod, 
          recordedByEmail: userEmail,
        });
      }
      
      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate,
        saleType: data.saleType,
        paymentMethod: data.paymentMethod, 
        items: saleItemsForDb,
        totalAmount: calculatedBillTotalAmount,
        totalPaidAmount: amountPaidThisTransaction,
        totalAmountDue: totalAmountDueForSale < 0 ? 0 : totalAmountDueForSale,
        paymentStatus: paymentStatus,
        paymentHistory: paymentHistory,
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
        recordedByEmail: userEmail,
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

export interface UpdateSaleStatusPayload {
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
  const userEmail = session.email || 'system_status_update';

  const { saleId, newStatus, currentTotalAmount } = payload;
  const saleRef = doc(db, SALES_COLLECTION, saleId);
  const now = Timestamp.now().toDate().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Sale not found.');
      }
      const currentSaleData = mapDocToSale(saleDoc); 

      const updateData: { [key: string]: any } = { 
        paymentStatus: newStatus,
        updatedAt: now,
      };
      let paymentHistoryEntry: PaymentTransaction | null = null;
      const saleTotalAmount = parseFloat(currentTotalAmount.toFixed(2));


      if (newStatus === 'paid') {
        const amountNeededToMakePaid = parseFloat((saleTotalAmount - currentSaleData.totalPaidAmount).toFixed(2));
        updateData.totalPaidAmount = saleTotalAmount;
        updateData.totalAmountDue = 0;
        
        let paymentAmountForHistory = amountNeededToMakePaid > EPSILON ? amountNeededToMakePaid : 0;
        let notesForHistory = `Status manually changed to 'Paid' by ${userEmail}.`;
        
        if (amountNeededToMakePaid < -EPSILON) { // Was overpaid
            notesForHistory += ` Original total paid Rs. ${currentSaleData.totalPaidAmount.toFixed(2)}. Amount adjusted to Rs. ${saleTotalAmount.toFixed(2)}.`;
        } else if (Math.abs(amountNeededToMakePaid) <= EPSILON && Math.abs(currentSaleData.totalPaidAmount - saleTotalAmount) <= EPSILON) {
            notesForHistory += ` Status confirmed as 'Paid'. No financial adjustment recorded.`;
        } else if (amountNeededToMakePaid > EPSILON) {
            notesForHistory += ` Adjustment payment of Rs. ${amountNeededToMakePaid.toFixed(2)} recorded.`;
        } else { 
             notesForHistory += ` Total paid amount (Rs. ${currentSaleData.totalPaidAmount.toFixed(2)}) considered full payment. No financial adjustment recorded.`;
        }
        
        paymentHistoryEntry = {
            date: now,
            amount: paymentAmountForHistory,
            paymentMethod: 'manual_adjustment',
            notes: notesForHistory,
            recordedByEmail: userEmail,
        };

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = saleTotalAmount;
        paymentHistoryEntry = {
          date: now,
          amount: 0, 
          paymentMethod: 'manual_adjustment',
          notes: `Status manually changed to 'Unpaid' by ${userEmail}. Original paid amount Rs. ${currentSaleData.totalPaidAmount.toFixed(2)} zeroed for status.`,
          recordedByEmail: userEmail,
        };
      } else if (newStatus === 'partially_paid') {
         updateData.totalPaidAmount = currentSaleData.totalPaidAmount;
         updateData.totalAmountDue = parseFloat((saleTotalAmount - currentSaleData.totalPaidAmount).toFixed(2));
         if (updateData.totalAmountDue < 0) updateData.totalAmountDue = 0;

         let notesForPartial = `Status manually changed to 'Partially Paid' by ${userEmail}.`;
         if (currentSaleData.paymentStatus === 'paid' && currentSaleData.totalPaidAmount > EPSILON) {
            notesForPartial += ` Was 'Paid'. Current paid: Rs. ${currentSaleData.totalPaidAmount.toFixed(2)}. Due: Rs. ${updateData.totalAmountDue.toFixed(2)}.`;
         } else if (currentSaleData.paymentStatus === 'unpaid') {
            notesForPartial += ` Was 'Unpaid'. Current paid: Rs. ${currentSaleData.totalPaidAmount.toFixed(2)}. Due: Rs. ${updateData.totalAmountDue.toFixed(2)}.`;
         } else {
            notesForPartial += ` Current paid: Rs. ${currentSaleData.totalPaidAmount.toFixed(2)}. Due: Rs. ${updateData.totalAmountDue.toFixed(2)}.`;
         }
         paymentHistoryEntry = {
            date: now,
            amount: 0, 
            paymentMethod: 'manual_adjustment',
            notes: notesForPartial,
            recordedByEmail: userEmail,
        };
      }

      if (paymentHistoryEntry) {
        updateData.paymentHistory = [...(currentSaleData.paymentHistory || []), paymentHistoryEntry];
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

export async function recordAdditionalPaymentAction(
  payload: RecordAdditionalPaymentPayload
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in to record a payment.' };
  }
  const userEmail = session.email || 'system_payment_record';
  const { saleId, amountPaidNow, paymentMethod, paymentNotes } = payload;

  if (amountPaidNow <= 0) {
    return { success: false, message: 'Payment amount must be positive.' };
  }

  const saleRef = doc(db, SALES_COLLECTION, saleId);
  const now = Timestamp.now().toDate().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('Sale not found.');
      }
      const currentSaleData = mapDocToSale(saleDoc);

      const currentDue = parseFloat(currentSaleData.totalAmountDue.toFixed(2));
      if (amountPaidNow > currentDue + EPSILON) {
        throw new Error(`Payment amount (Rs. ${amountPaidNow.toFixed(2)}) exceeds amount due (Rs. ${currentDue.toFixed(2)}). Please adjust or mark as full payment.`);
      }

      const newPaymentTransaction: PaymentTransaction = {
        date: now,
        amount: parseFloat(amountPaidNow.toFixed(2)),
        paymentMethod: paymentMethod,
        recordedByEmail: userEmail,
      };
      
      // Only add notes if paymentNotes has a value
      if (paymentNotes && paymentNotes.trim() !== "") {
        newPaymentTransaction.notes = paymentNotes.trim();
      }


      const updatedPaymentHistory = [...currentSaleData.paymentHistory, newPaymentTransaction];
      const newTotalPaidAmount = parseFloat((currentSaleData.totalPaidAmount + amountPaidNow).toFixed(2));
      let newTotalAmountDue = parseFloat((currentSaleData.totalAmount - newTotalPaidAmount).toFixed(2));
      
      if (newTotalAmountDue < EPSILON) { 
          newTotalAmountDue = 0;
      }

      let newPaymentStatus: Sale['paymentStatus'] = 'partially_paid';
      if (newTotalAmountDue <= EPSILON) {
        newPaymentStatus = 'paid';
      }

      const updateData: Partial<Sale> = {
        totalPaidAmount: newTotalPaidAmount,
        totalAmountDue: newTotalAmountDue,
        paymentStatus: newPaymentStatus,
        paymentHistory: updatedPaymentHistory,
        updatedAt: now,
      };

      transaction.update(saleRef, updateData);
    });

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Payment recorded successfully.' };

  } catch (error) {
    console.error('Error recording additional payment:', error);
    return { success: false, message: `Failed to record payment: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

