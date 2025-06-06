
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
const EPSILON = 0.001; 

const mapDocToSale = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Sale => {
  const data = document.data();
  if (!data) {
    throw new Error('Sale document data is undefined.');
  }
  const nowAsISO = new Date().toISOString();

  const paymentHistory: PaymentTransaction[] = [];
  if (Array.isArray(data.paymentHistory)) {
    data.paymentHistory.forEach((ph: any) => {
      const mappedTransaction: PaymentTransaction = {
        date: ph.date?.toDate ? ph.date.toDate().toISOString() : (typeof ph.date === 'string' ? ph.date : nowAsISO),
        amount: typeof ph.amount === 'number' ? ph.amount : 0,
        paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(ph.paymentMethod) ? ph.paymentMethod : 'manual_adjustment',
      };

      if (ph.notes && typeof ph.notes === 'string' && ph.notes.trim() !== "") {
        mappedTransaction.notes = ph.notes.trim();
      }
      if (ph.recordedByEmail && typeof ph.recordedByEmail === 'string' && ph.recordedByEmail.trim() !== "") {
        mappedTransaction.recordedByEmail = ph.recordedByEmail.trim();
      }
      paymentHistory.push(mappedTransaction);
    });
  }


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
    saleDate: typeof data.saleDate === 'string' ? data.saleDate : (data.saleDate?.toDate ? data.saleDate.toDate().toISOString().split('T')[0] : nowAsISO.split('T')[0]),
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(data.paymentMethod) ? data.paymentMethod as Sale['paymentMethod'] : undefined,
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : nowAsISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (typeof data.updatedAt === 'string' ? data.updatedAt : nowAsISO),
    recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
  };
};

export async function recordSaleAction(data: RecordSaleActionPayload) {
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
          ...item, 
          productNameSnapshot: product.name, 
          total: item.quantitySold * item.pricePerUnitSold,
        });
        calculatedBillTotalAmount += item.quantitySold * item.pricePerUnitSold;
      }
      
      const finalBillTotalAmount = parseFloat(calculatedBillTotalAmount.toFixed(2));
      const totalPaidAmountForSale = parseFloat(data.amountPaid.toFixed(2));


      if (Math.abs(finalBillTotalAmount - data.totalAmount) > EPSILON) {
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${finalBillTotalAmount}. Using server calculated item total.`);
      }
      if (totalPaidAmountForSale > finalBillTotalAmount + EPSILON) {
        throw new Error(`Amount paid (Rs. ${totalPaidAmountForSale}) cannot be greater than the total bill amount (Rs. ${finalBillTotalAmount}).`);
      }

      const now = Timestamp.now().toDate().toISOString();
      const totalAmountDueForSale = parseFloat((finalBillTotalAmount - totalPaidAmountForSale).toFixed(2));

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= EPSILON) { 
        paymentStatus = 'paid';
      } else if (totalPaidAmountForSale > EPSILON && totalAmountDueForSale > EPSILON) {
        paymentStatus = 'partially_paid';
      } else if (totalPaidAmountForSale <= EPSILON && finalBillTotalAmount > EPSILON) { 
        paymentStatus = 'unpaid';
      }
      
      const paymentHistory: PaymentTransaction[] = [];
      if (totalPaidAmountForSale > EPSILON) {
        const initialPayment: PaymentTransaction = {
          date: now,
          amount: totalPaidAmountForSale,
          paymentMethod: data.paymentMethod || 'cash',
          recordedByEmail: userEmail,
        };
        if (data.notes && data.notes.trim() !== "") {
          initialPayment.notes = data.notes.trim();
        }
        paymentHistory.push(initialPayment);
      }
      
      const newSaleData: Omit<Sale, 'id'> = {
        customerName: data.customerName || '',
        saleDate: data.saleDate,
        saleType: data.saleType,
        paymentMethod: paymentHistory.length > 0 ? (data.paymentMethod || 'cash') : undefined, 
        items: saleItemsForDb,
        totalAmount: finalBillTotalAmount,
        totalPaidAmount: totalPaidAmountForSale,
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
  currentTotalAmount: number; 
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
  const saleTotalAmountNum = Number(currentTotalAmount); 

  if (isNaN(saleTotalAmountNum)) {
      return { success: false, message: "Invalid current total amount provided for status update." };
  }

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
      
      const currentPaidNum = Number(currentSaleData.totalPaidAmount);
      if (isNaN(currentPaidNum)) {
        throw new Error("Invalid current paid amount in existing sale data.");
      }
      
      const paymentHistoryEntry: PaymentTransaction = {
        date: now,
        amount: 0, // Default, will be overridden if needed
        paymentMethod: 'manual_adjustment',
        recordedByEmail: userEmail,
      };
        
      if (newStatus === 'paid') {
        const amountNeededToMakePaid = parseFloat((saleTotalAmountNum - currentPaidNum).toFixed(2));
        updateData.totalPaidAmount = saleTotalAmountNum;
        updateData.totalAmountDue = 0;
        
        let notesForHistory = `Status manually changed to 'Paid' by ${userEmail}.`;
        if (amountNeededToMakePaid > EPSILON) {
             paymentHistoryEntry.amount = amountNeededToMakePaid;
             notesForHistory += ` Adjustment payment of Rs. ${amountNeededToMakePaid.toFixed(2)} recorded.`;
        } else if (amountNeededToMakePaid < -EPSILON) { // Overpaid, now corrected
             notesForHistory += ` Corrected from overpayment. Original paid Rs. ${currentPaidNum.toFixed(2)}.`;
        }
        paymentHistoryEntry.notes = notesForHistory;

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = saleTotalAmountNum;
        paymentHistoryEntry.notes = `Status manually changed to 'Unpaid' by ${userEmail}. Previous paid amount of Rs. ${currentPaidNum.toFixed(2)} is now disregarded for due calculation.`;

      } else if (newStatus === 'partially_paid') {
         updateData.totalPaidAmount = currentSaleData.totalPaidAmount; 
         updateData.totalAmountDue = parseFloat((saleTotalAmountNum - currentSaleData.totalPaidAmount).toFixed(2));
         if (updateData.totalAmountDue < 0) updateData.totalAmountDue = 0;

         let notesForPartial = `Status manually changed to 'Partially Paid' by ${userEmail}.`;
         if (Math.abs(updateData.totalAmountDue) <= EPSILON && updateData.totalPaidAmount > EPSILON) { 
            notesForPartial += " Current paid amount covers total bill; status implies ongoing payments or other context. Auto-corrected to 'paid'."
            updateData.paymentStatus = 'paid'; 
            updateData.totalAmountDue = 0;
         } else if (updateData.totalPaidAmount <= EPSILON) { 
            notesForPartial += " No payments recorded; status implies an expected initial partial payment. Auto-corrected to 'unpaid'."
            updateData.paymentStatus = 'unpaid'; 
            updateData.totalAmountDue = saleTotalAmountNum;
         }
         paymentHistoryEntry.notes = notesForPartial;
      }

      updateData.paymentHistory = [...(currentSaleData.paymentHistory || []), paymentHistoryEntry];
      
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

  const paymentAmountReceived = Number(amountPaidNow);
  if (isNaN(paymentAmountReceived) || paymentAmountReceived <= 0) { 
    return { success: false, message: 'Payment amount must be a positive number.' };
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

      const currentTotalAmount = Number(currentSaleData.totalAmount);
      const currentTotalPaidAmount = Number(currentSaleData.totalPaidAmount);
      
      if (isNaN(currentTotalAmount) || isNaN(currentTotalPaidAmount)) {
          throw new Error("Invalid numeric data encountered for existing sale amounts. Cannot record payment.");
      }

      const currentCalculatedDue = parseFloat((currentTotalAmount - currentTotalPaidAmount).toFixed(2));
      
      if (currentCalculatedDue <= EPSILON) {
        throw new Error("This bill is already fully paid. No further payments can be recorded.");
      }
      
      if (paymentAmountReceived > currentCalculatedDue + EPSILON) {
        throw new Error(`Payment amount (Rs. ${paymentAmountReceived.toFixed(2)}) exceeds amount due (Rs. ${currentCalculatedDue.toFixed(2)}).`);
      }

      const newPaymentTransaction: PaymentTransaction = {
        date: now,
        amount: paymentAmountReceived,
        paymentMethod: payload.paymentMethod,
        recordedByEmail: userEmail,
      };
      
      if (paymentNotes && typeof paymentNotes === 'string' && paymentNotes.trim() !== "") {
        newPaymentTransaction.notes = paymentNotes.trim();
      }


      const updatedPaymentHistory = [...currentSaleData.paymentHistory, newPaymentTransaction];
      const newTotalPaidAmount = parseFloat((currentTotalPaidAmount + paymentAmountReceived).toFixed(2));
      let newTotalAmountDue = parseFloat((currentTotalAmount - newTotalPaidAmount).toFixed(2));
      
      if (newTotalAmountDue < EPSILON && newTotalAmountDue > -EPSILON) { 
          newTotalAmountDue = 0;
      }

      let newPaymentStatus: Sale['paymentStatus'] = 'partially_paid';
      if (newTotalAmountDue <= EPSILON) {
        newPaymentStatus = 'paid';
      } else if (newTotalPaidAmount <= EPSILON && currentTotalAmount > EPSILON) {
        newPaymentStatus = 'unpaid'; 
      }


      const updateData: Partial<Sale> & {updatedAt: string} = {
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

