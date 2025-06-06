
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

  const paymentHistory: PaymentTransaction[] = Array.isArray(data.paymentHistory) ? data.paymentHistory.map((ph: any) => ({
    date: typeof ph.date === 'string' ? ph.date : (ph.date?.toDate ? ph.date.toDate().toISOString() : nowAsISO),
    amount: typeof ph.amount === 'number' ? ph.amount : 0,
    paymentMethod: (['cash', 'card', 'online', 'manual_adjustment'].includes(ph.paymentMethod) 
        ? ph.paymentMethod 
        : 'manual_adjustment') as PaymentTransaction['paymentMethod'], // Ensure valid string, default if not
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
    saleDate: typeof data.saleDate === 'string' ? data.saleDate : (data.saleDate?.toDate ? data.saleDate.toDate().toISOString().split('T')[0] : nowAsISO.split('T')[0]),
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    paymentMethod: ['cash', 'card', 'online'].includes(data.paymentMethod) ? data.paymentMethod as Sale['paymentMethod'] : undefined,
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
          ...item, // Spreads productId, quantitySold, pricePerUnitSold, soldUnit, baseUnitSnapshot
          productNameSnapshot: product.name, // Ensure this is set from product
          total: item.quantitySold * item.pricePerUnitSold,
        });
        calculatedBillTotalAmount += item.quantitySold * item.pricePerUnitSold;
      }
      
      const finalBillTotalAmount = parseFloat(calculatedBillTotalAmount.toFixed(2));
      const amountPaidThisTransaction = parseFloat(data.amountPaid.toFixed(2));


      if (Math.abs(finalBillTotalAmount - data.totalAmount) > EPSILON) {
         console.warn(`Total amount discrepancy. Client form passed totalAmount: ${data.totalAmount}, Server calculated item total: ${finalBillTotalAmount}. Using server calculated item total.`);
      }
      if (amountPaidThisTransaction > finalBillTotalAmount + EPSILON) {
        throw new Error(`Amount paid (Rs. ${amountPaidThisTransaction}) cannot be greater than the total bill amount (Rs. ${finalBillTotalAmount}).`);
      }

      const now = Timestamp.now().toDate().toISOString();
      const totalAmountDueForSale = parseFloat((finalBillTotalAmount - amountPaidThisTransaction).toFixed(2));

      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (totalAmountDueForSale <= EPSILON) { 
        paymentStatus = 'paid';
      } else if (amountPaidThisTransaction > EPSILON && totalAmountDueForSale > EPSILON) {
        paymentStatus = 'partially_paid';
      } else if (amountPaidThisTransaction <= EPSILON && finalBillTotalAmount > EPSILON) {
        paymentStatus = 'unpaid';
      }

      const paymentHistory: PaymentTransaction[] = [];
      if (amountPaidThisTransaction > EPSILON) {
        const initialPayment: PaymentTransaction = {
          date: now,
          amount: amountPaidThisTransaction,
          paymentMethod: data.paymentMethod || 'cash', // Default to 'cash' if undefined
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
        paymentMethod: data.paymentMethod || 'cash', 
        items: saleItemsForDb,
        totalAmount: finalBillTotalAmount,
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
      let paymentHistoryEntry: PaymentTransaction | null = null;
      const currentPaidNum = Number(currentSaleData.totalPaidAmount);

      if (isNaN(currentPaidNum)) {
        throw new Error("Invalid current paid amount in existing sale data.");
      }
      
      if (newStatus === 'paid') {
        const amountNeededToMakePaid = parseFloat((saleTotalAmountNum - currentPaidNum).toFixed(2));
        updateData.totalPaidAmount = saleTotalAmountNum;
        updateData.totalAmountDue = 0;
        
        let notesForHistory = `Status manually changed to 'Paid' by ${userEmail}.`;
        if (amountNeededToMakePaid < -EPSILON) { 
            notesForHistory += ` Original total paid Rs. ${currentPaidNum.toFixed(2)}. Adjusted to Rs. ${saleTotalAmountNum.toFixed(2)}.`;
        } else if (Math.abs(amountNeededToMakePaid) <= EPSILON && Math.abs(currentPaidNum - saleTotalAmountNum) <= EPSILON) {
             // Already paid, just confirming status
        } else if (amountNeededToMakePaid > EPSILON) {
            notesForHistory += ` Adjustment payment of Rs. ${amountNeededToMakePaid.toFixed(2)} recorded.`;
        }
        
        paymentHistoryEntry = {
            date: now,
            amount: amountNeededToMakePaid > EPSILON ? amountNeededToMakePaid : 0,
            paymentMethod: 'manual_adjustment',
            notes: notesForHistory,
            recordedByEmail: userEmail,
        };

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = saleTotalAmountNum;
        paymentHistoryEntry = {
          date: now,
          amount: 0, 
          paymentMethod: 'manual_adjustment',
          notes: `Status manually changed to 'Unpaid' by ${userEmail}. Original paid amount Rs. ${currentPaidNum.toFixed(2)} effectively zeroed for status tracking.`,
          recordedByEmail: userEmail,
        };
      } else if (newStatus === 'partially_paid') {
         updateData.totalPaidAmount = currentPaidNum; 
         updateData.totalAmountDue = parseFloat((saleTotalAmountNum - currentPaidNum).toFixed(2));
         if (updateData.totalAmountDue < 0) updateData.totalAmountDue = 0;

         let notesForPartial = `Status manually changed to 'Partially Paid' by ${userEmail}.`;
         if (currentSaleData.paymentStatus === 'paid') {
            notesForPartial += ` Was 'Paid'. Financials reflect current paid amount.`;
         } else if (currentSaleData.paymentStatus === 'unpaid') {
            notesForPartial += ` Was 'Unpaid'. Financials reflect current (likely zero) paid amount.`;
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
          throw new Error("Invalid numeric data encountered for existing sale amounts.");
      }
      
      const currentCalculatedDue = parseFloat((currentTotalAmount - currentTotalPaidAmount).toFixed(2));
      
      if (paymentAmountReceived > currentCalculatedDue + EPSILON) {
        throw new Error(`Payment amount (Rs. ${paymentAmountReceived.toFixed(2)}) exceeds amount due (Rs. ${currentCalculatedDue.toFixed(2)}).`);
      }

      const newPaymentTransaction: PaymentTransaction = {
        date: now,
        amount: paymentAmountReceived,
        paymentMethod: paymentMethod, // This comes from payload, which is 'cash' | 'card' | 'online'
        recordedByEmail: userEmail,
      };
      
      if (paymentNotes && paymentNotes.trim() !== "") {
        newPaymentTransaction.notes = paymentNotes.trim();
      } else {
        // Ensure notes field is not undefined if it's empty, pass null or omit
        // For Firestore, omitting is cleaner if the value is truly absent.
        // delete newPaymentTransaction.notes; // Alternative: omit if undefined
      }


      const updatedPaymentHistory = [...currentSaleData.paymentHistory, newPaymentTransaction];
      const newTotalPaidAmount = parseFloat((currentTotalPaidAmount + paymentAmountReceived).toFixed(2));
      let newTotalAmountDue = parseFloat((currentTotalAmount - newTotalPaidAmount).toFixed(2));
      
      if (newTotalAmountDue < EPSILON) { 
          newTotalAmountDue = 0;
      }

      let newPaymentStatus: Sale['paymentStatus'] = 'partially_paid';
      if (newTotalAmountDue <= EPSILON) {
        newPaymentStatus = 'paid';
      } else if (newTotalPaidAmount <= EPSILON && currentTotalAmount > EPSILON) {
        newPaymentStatus = 'unpaid';
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

