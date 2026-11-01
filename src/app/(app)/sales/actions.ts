
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { collection, addDoc, doc, runTransaction, Timestamp, getDocs, query, orderBy, getDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/firebase';
import type { RecordSaleActionPayload, SaleFormData } from './schema';
import type { Product, Sale, SaleItem, PaymentTransaction, RecordAdditionalPaymentPayload, Customer } from '@/lib/types';
import type { ProductUnit } from '@/lib/constants';
import { getSession, type SessionData } from '@/app/login/actions';
import { getFromMemoryCache, setMemoryCache, invalidateMemoryCache } from '@/lib/memory-cache';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';
const CUSTOMERS_COLLECTION = 'customers';
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
        recordedByEmail: typeof ph.recordedByEmail === 'string' ? ph.recordedByEmail : undefined,
        recordedByName: typeof ph.recordedByName === 'string' ? ph.recordedByName : undefined,
      };

      if (ph.notes && typeof ph.notes === 'string' && ph.notes.trim() !== "") {
        mappedTransaction.notes = ph.notes.trim();
      }
      paymentHistory.push(mappedTransaction);
    });
  }


  return {
    id: document.id,
    items: Array.isArray(data.items) ? data.items.map((item: any): SaleItem => ({
      productId: typeof item.productId === 'string' ? item.productId : undefined,
      productNameSnapshot: typeof item.productNameSnapshot === 'string' ? item.productNameSnapshot : '',
      quantitySold: typeof item.quantitySold === 'number' ? item.quantitySold : 0,
      pricePerUnitSold: typeof item.pricePerUnitSold === 'number' ? item.pricePerUnitSold : 0,
      soldUnit: typeof item.soldUnit === 'string' ? item.soldUnit as ProductUnit : 'piece',
      baseUnitSnapshot: typeof item.baseUnitSnapshot === 'string' ? item.baseUnitSnapshot as ProductUnit : 'piece',
      total: typeof item.total === 'number' ? item.total : 0,
    })) : [],
    packagingCharges: typeof data.packagingCharges === 'number' ? data.packagingCharges : undefined,
    transportCharges: typeof data.transportCharges === 'number' ? data.transportCharges : undefined,
    discountType: ['percentage', 'fixed'].includes(data.discountType) ? data.discountType : undefined,
    discountValue: typeof data.discountValue === 'number' ? data.discountValue : undefined,
    discountAmount: typeof data.discountAmount === 'number' ? data.discountAmount : undefined,
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
    totalPaidAmount: typeof data.totalPaidAmount === 'number' ? data.totalPaidAmount : 0,
    totalAmountDue: typeof data.totalAmountDue === 'number' ? data.totalAmountDue : 0,
    paymentStatus: ['paid', 'partially_paid', 'unpaid'].includes(data.paymentStatus) ? data.paymentStatus as Sale['paymentStatus'] : 'unpaid',
    paymentHistory: paymentHistory,
    saleType: data.saleType === 'retail' ? 'retail' : 'wholesale',
    saleDate: typeof data.saleDate === 'string' ? data.saleDate : (data.saleDate?.toDate ? data.saleDate.toDate().toISOString().split('T')[0] : nowAsISO.split('T')[0]),
    customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    customerPhone: typeof data.customerPhone === 'string' ? data.customerPhone : undefined,
    customerNameInitiallyEmpty: typeof data.customerNameInitiallyEmpty === 'boolean' ? data.customerNameInitiallyEmpty : undefined,
    staffMadeInitialEdit: typeof data.staffMadeInitialEdit === 'boolean' ? data.staffMadeInitialEdit : undefined,
    paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(data.paymentMethod) ? data.paymentMethod as Sale['paymentMethod'] : undefined,
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : nowAsISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (typeof data.updatedAt === 'string' ? data.updatedAt : nowAsISO),
    recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
    recordedByName: typeof data.recordedByName === 'string' ? data.recordedByName : undefined,
  };
};

export async function recordSaleAction(data: RecordSaleActionPayload) {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "User session not found or invalid. Cannot record sale." };
  }
  const userEmail = session.email;
  const userName = session.name;
  console.log(`[recordSaleAction] Recording sale. User Name: '${userName}', User Email: '${userEmail}'`);

  let targetCustomerId = data.customerId?.trim() || undefined;
  let isNewCustomer = false;
  const trimmedCustomerName = data.customerName?.trim() || '';
  const trimmedCustomerPhone = data.customerPhone?.trim() || '';

  // Look up existing customer if customerId not explicitly provided, but customerName provided
  if (!targetCustomerId && trimmedCustomerName) {
    try {
      const custQuery = query(
        collection(db, CUSTOMERS_COLLECTION),
        where('name', '==', trimmedCustomerName)
      );
      const custSnap = await getDocs(custQuery);
      if (!custSnap.empty) {
        targetCustomerId = custSnap.docs[0].id;
      } else {
        const newCustRef = doc(collection(db, CUSTOMERS_COLLECTION));
        targetCustomerId = newCustRef.id;
        isNewCustomer = true;
      }
    } catch (e) {
      console.warn('Customer lookup fallback:', e);
      const newCustRef = doc(collection(db, CUSTOMERS_COLLECTION));
      targetCustomerId = newCustRef.id;
      isNewCustomer = true;
    }
  }

  try {
    await runTransaction(db, async (transaction) => {
      // READ PHASE: Read all products
      const productsToUpdate: Array<{ ref: any; newStock: number }> = [];
      const saleItemsForDb: SaleItem[] = [];
      let itemsTotalAmount = 0;

      for (const item of data.items) {
        if (item.productId && item.productId.trim() !== "") {
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
          productsToUpdate.push({ ref: productRef, newStock });

          saleItemsForDb.push({
            productId: item.productId,
            productNameSnapshot: product.name,
            baseUnitSnapshot: product.baseUnit,
            quantitySold: item.quantitySold,
            pricePerUnitSold: item.pricePerUnitSold,
            soldUnit: item.soldUnit,
            total: item.quantitySold * item.pricePerUnitSold,
          });
        } else {
          // Ad-hoc item
          saleItemsForDb.push({
            productNameSnapshot: item.productNameSnapshot,
            baseUnitSnapshot: item.baseUnitSnapshot,
            quantitySold: item.quantitySold,
            pricePerUnitSold: item.pricePerUnitSold,
            soldUnit: item.soldUnit,
            total: item.quantitySold * item.pricePerUnitSold,
          });
        }
        itemsTotalAmount += item.quantitySold * item.pricePerUnitSold;
      }

      // READ PHASE: Read customer if targetCustomerId exists
      let customerRef: any = null;
      let existingCustomerData: any = null;
      if (targetCustomerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, targetCustomerId);
        if (!isNewCustomer) {
          const customerSnap = await transaction.get(customerRef);
          if (customerSnap.exists()) {
            existingCustomerData = customerSnap.data();
          } else {
            isNewCustomer = true;
          }
        }
      }

      // CALCULATIONS
      let calculatedDiscount = 0;
      if (data.saleType !== 'wholesale' && data.discountValue && data.discountValue > 0) {
        if (data.discountType === 'percentage') {
          calculatedDiscount = parseFloat(((itemsTotalAmount * data.discountValue) / 100).toFixed(2));
        } else {
          calculatedDiscount = parseFloat(data.discountValue.toFixed(2));
        }
      }
      calculatedDiscount = Math.min(itemsTotalAmount, calculatedDiscount);

      const finalBillTotalAmount = parseFloat(
        Math.max(0, itemsTotalAmount - calculatedDiscount + (data.packagingCharges || 0) + (data.transportCharges || 0)).toFixed(2)
      );
      const totalPaidAmountForSale = parseFloat(data.amountPaid.toFixed(2));

      if (Math.abs(finalBillTotalAmount - data.totalAmount) > EPSILON) {
         console.warn(`Client-side totalAmount ${data.totalAmount} differs from server-calculated ${finalBillTotalAmount}. Using server total.`);
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
          recordedByName: userName,
        };
        if (data.notes && data.notes.trim() !== "") {
          initialPayment.notes = data.notes.trim();
        }
        paymentHistory.push(initialPayment);
      }

      const newSaleDocRef = doc(collection(db, SALES_COLLECTION));

      const newSaleDataObject: any = {
        customerName: trimmedCustomerName,
        customerPhone: trimmedCustomerPhone || undefined,
        customerId: targetCustomerId || undefined,
        customerNameInitiallyEmpty: !trimmedCustomerName || trimmedCustomerName === '',
        saleDate: data.saleDate,
        saleType: data.saleType === 'retail' ? 'retail' : 'wholesale',
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
        recordedByName: userName,
      };

      if (data.saleType !== 'wholesale' && calculatedDiscount > 0) {
        newSaleDataObject.discountType = data.discountType || 'fixed';
        newSaleDataObject.discountValue = data.discountValue || 0;
        newSaleDataObject.discountAmount = calculatedDiscount;
      }

      if (paymentHistory.length > 0 && data.paymentMethod) {
        newSaleDataObject.paymentMethod = data.paymentMethod;
      }
      if (data.packagingCharges !== undefined && data.packagingCharges > 0) {
        newSaleDataObject.packagingCharges = data.packagingCharges;
      }
      if (data.transportCharges !== undefined && data.transportCharges > 0) {
        newSaleDataObject.transportCharges = data.transportCharges;
      }

      // WRITE PHASE: 1. Update product stocks
      for (const prodUpdate of productsToUpdate) {
        transaction.update(prodUpdate.ref, {
          quantityInStock: prodUpdate.newStock,
          updatedAt: now,
          lastStockUpdateByEmail: userEmail,
          lastStockUpdateByName: userName,
        });
      }

      // WRITE PHASE: 2. Create or update customer profile & transaction ledger
      if (targetCustomerId && customerRef) {
        let newCustomerTotalDue = totalAmountDueForSale;
        let newCustomerTotalPurchases = finalBillTotalAmount;
        let newCustomerTotalPaid = totalPaidAmountForSale;

        if (!isNewCustomer && existingCustomerData) {
          newCustomerTotalDue = parseFloat(((existingCustomerData.totalDue || 0) + totalAmountDueForSale).toFixed(2));
          newCustomerTotalPurchases = parseFloat(((existingCustomerData.totalPurchases || 0) + finalBillTotalAmount).toFixed(2));
          newCustomerTotalPaid = parseFloat(((existingCustomerData.totalPaid || 0) + totalPaidAmountForSale).toFixed(2));

          const customerUpdates: Record<string, any> = {
            totalDue: newCustomerTotalDue < 0.001 && newCustomerTotalDue > -0.001 ? 0 : newCustomerTotalDue,
            totalPurchases: newCustomerTotalPurchases,
            totalPaid: newCustomerTotalPaid,
            updatedAt: now,
          };
          if (trimmedCustomerPhone && !existingCustomerData.phone) {
            customerUpdates.phone = trimmedCustomerPhone;
          }
          transaction.update(customerRef, customerUpdates);
        } else {
          transaction.set(customerRef, {
            name: trimmedCustomerName || 'Walk-in Customer',
            phone: trimmedCustomerPhone || '',
            totalDue: newCustomerTotalDue < 0.001 && newCustomerTotalDue > -0.001 ? 0 : newCustomerTotalDue,
            totalPurchases: newCustomerTotalPurchases,
            totalPaid: newCustomerTotalPaid,
            createdAt: now,
            updatedAt: now,
            createdByEmail: userEmail,
            createdByName: userName,
          });
        }

        // Add transaction entry to customer's subcollection
        const custTxRef = doc(collection(db, CUSTOMERS_COLLECTION, targetCustomerId, 'transactions'));
        transaction.set(custTxRef, {
          customerId: targetCustomerId,
          type: 'sale',
          saleId: newSaleDocRef.id,
          amount: finalBillTotalAmount,
          amountPaid: totalPaidAmountForSale,
          dueAdded: totalAmountDueForSale,
          balanceAfter: newCustomerTotalDue,
          paymentMethod: data.paymentMethod || 'cash',
          date: data.saleDate,
          notes: data.notes || '',
          createdAt: now,
          recordedByEmail: userEmail,
          recordedByName: userName,
        });
      }

      // WRITE PHASE: 3. Set sale document
      transaction.set(newSaleDocRef, newSaleDataObject as Omit<Sale, 'id'>);
    });

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
    revalidateTag('products');
    revalidateTag('customers');
    revalidatePath('/sales');
    revalidatePath('/customers');
    if (targetCustomerId) {
      revalidatePath(`/customers/${targetCustomerId}`);
    }
    revalidatePath('/products');
    revalidatePath('/dashboard');

    return { success: true, message: 'Sale recorded successfully!' };
  } catch (error) {
    console.error("Error recording sale:", error);
    return { success: false, message: `Failed to record sale: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

const getSalesCached = unstable_cache(
  async () => {
    console.log('[getSalesAction_CACHE_WRAPPER] Cache miss or revalidating: Fetching sales from Firestore');
    try {
      const q = query(collection(db, SALES_COLLECTION), orderBy("saleDate", "desc"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const sales = querySnapshot.docs.map(mapDocToSale);
      return sales;
    } catch (error) {
      console.error("Error fetching sales from Firestore (within cache wrapper):", error);
      return [];
    }
  },
  ['sales_list'],
  {
    revalidate: 3600, // 1 hour
    tags: ['sales'],
  }
);

export async function getSalesAction(): Promise<Sale[]> {
  const memoryCached = getFromMemoryCache<Sale[]>('sales');
  if (memoryCached) return memoryCached;
  const sales = await getSalesCached();
  setMemoryCache('sales', sales, 60);
  return sales;
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
  const userEmail = session.email;
  const userName = session.name;
  console.log(`[updateSalePaymentStatusAction] Updating status. User Name: '${userName}', User Email: '${userEmail}'`);


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
        amount: 0,
        paymentMethod: 'manual_adjustment',
        recordedByEmail: userEmail,
        recordedByName: userName,
      };

      if (newStatus === 'paid') {
        const amountNeededToMakePaid = parseFloat((saleTotalAmountNum - currentPaidNum).toFixed(2));
        updateData.totalPaidAmount = saleTotalAmountNum;
        updateData.totalAmountDue = 0;

        let notesForHistory = `Status manually changed to 'Paid' by ${userName}.`;
        if (amountNeededToMakePaid > EPSILON) {
             paymentHistoryEntry.amount = amountNeededToMakePaid;
             notesForHistory += ` Adjustment payment of Rs. ${amountNeededToMakePaid.toFixed(2)} recorded.`;
        } else if (amountNeededToMakePaid < -EPSILON) {
             notesForHistory += ` Corrected from overpayment. Original paid Rs. ${currentPaidNum.toFixed(2)}.`;
        }
        paymentHistoryEntry.notes = notesForHistory;

      } else if (newStatus === 'unpaid') {
        updateData.totalPaidAmount = 0;
        updateData.totalAmountDue = saleTotalAmountNum;
        paymentHistoryEntry.notes = `Status manually changed to 'Unpaid' by ${userName}. Previous paid amount of Rs. ${currentPaidNum.toFixed(2)} is now disregarded for due calculation.`;

      } else if (newStatus === 'partially_paid') {
         updateData.totalPaidAmount = currentSaleData.totalPaidAmount;
         updateData.totalAmountDue = parseFloat((saleTotalAmountNum - currentSaleData.totalPaidAmount).toFixed(2));
         if (updateData.totalAmountDue < 0) updateData.totalAmountDue = 0;

         let notesForPartial = `Status manually changed to 'Partially Paid' by ${userName}.`;
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

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
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
  const userEmail = session.email;
  const userName = session.name;
  console.log(`[recordAdditionalPaymentAction] Recording payment. User Name: '${userName}', User Email: '${userEmail}'`);

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

      // Read customer if linked
      let customerRef: any = null;
      let customerSnap: any = null;
      if (currentSaleData.customerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, currentSaleData.customerId);
        customerSnap = await transaction.get(customerRef);
      }

      const newPaymentTransaction: PaymentTransaction = {
        date: now,
        amount: paymentAmountReceived,
        paymentMethod: payload.paymentMethod,
        recordedByEmail: userEmail,
        recordedByName: userName,
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

      // WRITE: Update sale doc
      transaction.update(saleRef, updateData);

      // WRITE: Update customer balance and transaction ledger
      if (currentSaleData.customerId && customerRef && customerSnap && customerSnap.exists()) {
        const custData = customerSnap.data();
        const currentCustDue = Number(custData.totalDue) || 0;
        const currentCustPaid = Number(custData.totalPaid) || 0;
        const newCustDue = parseFloat((currentCustDue - paymentAmountReceived).toFixed(2));
        const newCustPaid = parseFloat((currentCustPaid + paymentAmountReceived).toFixed(2));

        transaction.update(customerRef, {
          totalDue: newCustDue < 0.001 && newCustDue > -0.001 ? 0 : newCustDue,
          totalPaid: newCustPaid,
          updatedAt: now,
        });

        const custTxRef = doc(collection(db, CUSTOMERS_COLLECTION, currentSaleData.customerId, 'transactions'));
        transaction.set(custTxRef, {
          customerId: currentSaleData.customerId,
          type: 'payment',
          saleId: saleId,
          amount: paymentAmountReceived,
          dueAdded: -paymentAmountReceived,
          balanceAfter: newCustDue,
          paymentMethod: payload.paymentMethod,
          date: now.split('T')[0],
          notes: paymentNotes && paymentNotes.trim() ? paymentNotes.trim() : `Payment for Sale invoice #${saleId}`,
          createdAt: now,
          recordedByEmail: userEmail,
          recordedByName: userName,
        });
      }
    });

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
    revalidateTag('customers');
    revalidatePath('/sales');
    revalidatePath('/customers');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Payment recorded successfully.' };

  } catch (error) {
    console.error('Error recording additional payment:', error);
    return { success: false, message: `Failed to record payment: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


export async function deleteSaleAction(saleId: string): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in.' };
  }
  if (session.role !== 'owner') {
    return { success: false, message: 'Unauthorized: Only owners can delete sales.' };
  }

  const userEmail = session.email;
  const userName = session.name;
  console.log(`[deleteSaleAction] Deleting sale ID: ${saleId}. User: ${userName} (${userEmail})`);

  const saleRef = doc(db, SALES_COLLECTION, saleId);
  const nowISO = Timestamp.now().toDate().toISOString();

  try {
    let customerIdForReval: string | undefined;

    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error("Sale not found. It may have already been deleted.");
      }
      const saleData = mapDocToSale(saleDoc);
      customerIdForReval = saleData.customerId;

      // READ: customer if linked
      let customerRef: any = null;
      let customerSnap: any = null;
      if (saleData.customerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, saleData.customerId);
        customerSnap = await transaction.get(customerRef);
      }

      // READ & PREPARE: products
      const productsToUpdate: Array<{ ref: any; newStock: number; id: string; qtyRestored: number }> = [];
      for (const item of saleData.items) {
        if (!item.productId) {
          console.log(`[deleteSaleAction] Item "${item.productNameSnapshot}" in sale ${saleId} is unlisted. Skipping stock restoration.`);
          continue;
        }
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists()) {
          console.warn(`Product ID ${item.productId} (Snapshot: ${item.productNameSnapshot}) from deleted sale ${saleId} not found. Stock cannot be restored for this item.`);
          continue;
        }

        const productData = productDoc.data() as Product;
        let quantityToRestoreInBaseUnits = item.quantitySold;

        if (item.soldUnit === productData.purchaseUnit && productData.baseUnit !== productData.purchaseUnit && productData.purchaseUnitConversionFactor > 0) {
          quantityToRestoreInBaseUnits = item.quantitySold * productData.purchaseUnitConversionFactor;
        }

        const newStockInBaseUnits = (productData.quantityInStock || 0) + quantityToRestoreInBaseUnits;
        productsToUpdate.push({ ref: productRef, newStock: newStockInBaseUnits, id: item.productId, qtyRestored: quantityToRestoreInBaseUnits });
      }

      // WRITE: products
      for (const p of productsToUpdate) {
        transaction.update(p.ref, {
          quantityInStock: p.newStock,
          updatedAt: nowISO,
          lastStockUpdateByEmail: userEmail,
          lastStockUpdateByName: userName,
        });
        console.log(`[deleteSaleAction] Restored ${p.qtyRestored} (base units) to product ${p.id}. New stock: ${p.newStock}`);
      }

      // WRITE: customer adjustment if linked
      if (saleData.customerId && customerRef && customerSnap && customerSnap.exists()) {
        const custData = customerSnap.data();
        const currentCustDue = Number(custData.totalDue) || 0;
        const currentCustPurchases = Number(custData.totalPurchases) || 0;
        const currentCustPaid = Number(custData.totalPaid) || 0;

        const newCustDue = parseFloat((currentCustDue - (saleData.totalAmountDue || 0)).toFixed(2));
        const newCustPurchases = parseFloat((currentCustPurchases - (saleData.totalAmount || 0)).toFixed(2));
        const newCustPaid = parseFloat((currentCustPaid - (saleData.totalPaidAmount || 0)).toFixed(2));

        transaction.update(customerRef, {
          totalDue: newCustDue < 0.001 && newCustDue > -0.001 ? 0 : (newCustDue < 0 ? 0 : newCustDue),
          totalPurchases: newCustPurchases < 0 ? 0 : newCustPurchases,
          totalPaid: newCustPaid < 0 ? 0 : newCustPaid,
          updatedAt: nowISO,
        });

        const custTxRef = doc(collection(db, CUSTOMERS_COLLECTION, saleData.customerId, 'transactions'));
        transaction.set(custTxRef, {
          customerId: saleData.customerId,
          type: 'adjustment',
          saleId: saleId,
          amount: saleData.totalAmount,
          dueAdded: -(saleData.totalAmountDue || 0),
          balanceAfter: newCustDue,
          date: nowISO.split('T')[0],
          notes: `Sale #${saleId} deleted. Due balance adjusted.`,
          createdAt: nowISO,
          recordedByEmail: userEmail,
          recordedByName: userName,
        });
      }

      transaction.delete(saleRef);
      console.log(`[deleteSaleAction] Sale ${saleId} deleted successfully.`);
    });

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
    revalidateTag('products');
    revalidateTag('customers');
    revalidatePath('/sales');
    revalidatePath('/customers');
    if (customerIdForReval) {
      revalidatePath(`/customers/${customerIdForReval}`);
    }
    revalidatePath('/dashboard');

    return { success: true, message: 'Sale deleted successfully and product stock (for listed items) restored.' };
  } catch (error) {
    console.error(`Error deleting sale ${saleId}:`, error);
    return { success: false, message: `Failed to delete sale: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function updateSaleCustomerNameAction(
  saleId: string,
  newCustomerName: string
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "Unauthorized: You must be logged in." };
  }

  if (!newCustomerName || newCustomerName.trim() === "") {
    // Allow setting to empty if it was initially empty and staff is making their one edit (or owner anytime)
    // But generally, if a name exists, UI should prevent submitting an empty new name.
    // For now, we'll allow empty string to signify clearing, but it's better handled by UI validation if a name is expected.
  }
  const trimmedNewName = newCustomerName.trim();

  const saleRef = doc(db, SALES_COLLECTION, saleId);
  const nowISO = Timestamp.now().toDate().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error("Sale not found.");
      }
      const saleData = mapDocToSale(saleDoc);
      const updatePayload: { customerName: string; updatedAt: string; staffMadeInitialEdit?: boolean } = {
        customerName: trimmedNewName,
        updatedAt: nowISO,
      };

      if (session.role === 'owner') {
        // Owners can always edit
      } else if (session.role === 'staff') {
        if (saleData.customerNameInitiallyEmpty && !saleData.staffMadeInitialEdit) {
          updatePayload.staffMadeInitialEdit = true;
        } else {
          throw new Error("Staff members are not permitted to change the customer name for this sale, or have already made their one-time edit.");
        }
      } else {
        throw new Error("Unauthorized role for this action.");
      }
      transaction.update(saleRef, updatePayload);
    });

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/sales');
    revalidatePath('/dashboard'); // Customer name might appear in recent activity

    return { success: true, message: "Customer name updated successfully." };
  } catch (error) {
    console.error("Error updating sale customer name:", error);
    return { success: false, message: `Failed to update customer name: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function updateSaleAction(
  saleId: string,
  updatedFormData: SaleFormData,
  updatedItemsForAction: RecordSaleActionPayload['items']
): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return { success: false, message: "Unauthorized: Only owners can edit sales." };
  }

  const userEmail = session.email;
  const userName = session.name;
  console.log(`[updateSaleAction] Updating sale ${saleId}. User: '${userName}'`);

  try {
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, SALES_COLLECTION, saleId);
      const originalSaleDoc = await transaction.get(saleRef);
      if (!originalSaleDoc.exists()) {
        throw new Error("Sale not found.");
      }
      const originalSaleData = mapDocToSale(originalSaleDoc);

      // READ: customer if linked
      let customerRef: any = null;
      let customerSnap: any = null;
      if (originalSaleData.customerId) {
        customerRef = doc(db, CUSTOMERS_COLLECTION, originalSaleData.customerId);
        customerSnap = await transaction.get(customerRef);
      }

      const stockChanges = new Map<string, number>();

      const originalItemsMap = new Map(originalSaleData.items.map(item => [item.productId, item]));
      const updatedItemsMap = new Map(updatedItemsForAction.map(item => [item.productId, item]));
      
      const allProductIds = new Set([...originalItemsMap.keys(), ...updatedItemsMap.keys()].filter(id => id));

      for (const productId of allProductIds) {
        if (!productId) continue;
        const originalItem = originalItemsMap.get(productId);
        const updatedItem = updatedItemsMap.get(productId);

        const productRef = doc(db, PRODUCTS_COLLECTION, productId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
            throw new Error(`Product with ID ${productId} not found during update.`);
        }
        const product = productSnap.data() as Product;

        const getQuantityInBaseUnits = (item: SaleItem) => {
            if (item.soldUnit === product.purchaseUnit && product.baseUnit !== product.purchaseUnit) {
                return item.quantitySold * (product.purchaseUnitConversionFactor || 1);
            }
            return item.quantitySold;
        }

        const originalQtyInBase = originalItem ? getQuantityInBaseUnits(originalItem) : 0;
        const updatedQtyInBase = updatedItem ? getQuantityInBaseUnits(updatedItem) : 0;
        const stockDifference = originalQtyInBase - updatedQtyInBase;

        if (stockDifference !== 0) {
            stockChanges.set(productId, (stockChanges.get(productId) || 0) + stockDifference);
        }
      }
      
      for (const [productId, stockChange] of stockChanges.entries()) {
        const productRef = doc(db, PRODUCTS_COLLECTION, productId);
        const productSnap = await transaction.get(productRef);
        const product = productSnap.data() as Product;
        const newStock = product.quantityInStock + stockChange;

        if (newStock < 0) {
            throw new Error(`Insufficient stock for "${product.name}". Required: ${-stockChange}, Available: ${product.quantityInStock - (stockChanges.get(productId) || 0)}`);
        }
        transaction.update(productRef, { 
            quantityInStock: newStock,
            updatedAt: Timestamp.now().toDate().toISOString(),
            lastStockUpdateByEmail: userEmail,
            lastStockUpdateByName: userName
        });
      }

      // Now, update the sale document itself
      const finalItemsTotal = updatedItemsForAction.reduce((sum, item) => sum + item.total, 0);
      const finalPackagingCharges = Number(updatedFormData.packagingCharges) || 0;
      const finalTransportCharges = Number(updatedFormData.transportCharges) || 0;
      const finalGrandTotal = parseFloat((finalItemsTotal + finalPackagingCharges + finalTransportCharges).toFixed(2));
      const finalAmountPaid = Number(updatedFormData.amountPaid) || 0;

      if (finalAmountPaid > finalGrandTotal + EPSILON) {
        throw new Error(`Amount paid (Rs. ${finalAmountPaid.toFixed(2)}) cannot be greater than the new total bill (Rs. ${finalGrandTotal.toFixed(2)}).`);
      }

      const finalAmountDue = parseFloat((finalGrandTotal - finalAmountPaid).toFixed(2));
      let paymentStatus: Sale['paymentStatus'] = 'unpaid';
      if (finalAmountDue <= EPSILON) paymentStatus = 'paid';
      else if (finalAmountPaid > EPSILON) paymentStatus = 'partially_paid';

      const now = Timestamp.now().toDate().toISOString();

      const saleUpdateData = {
        ...updatedFormData,
        items: updatedItemsForAction,
        totalAmount: finalGrandTotal,
        totalPaidAmount: finalAmountPaid,
        totalAmountDue: finalAmountDue,
        paymentStatus: paymentStatus,
        updatedAt: now,
      };
      
      transaction.update(saleRef, saleUpdateData);

      // Update customer totals if linked
      if (originalSaleData.customerId && customerRef && customerSnap && customerSnap.exists()) {
        const custData = customerSnap.data();
        const prevCustDue = Number(custData.totalDue) || 0;
        const prevCustPurchases = Number(custData.totalPurchases) || 0;
        const prevCustPaid = Number(custData.totalPaid) || 0;

        const purchaseDiff = finalGrandTotal - (originalSaleData.totalAmount || 0);
        const paidDiff = finalAmountPaid - (originalSaleData.totalPaidAmount || 0);
        const dueDiff = finalAmountDue - (originalSaleData.totalAmountDue || 0);

        const newCustDue = parseFloat((prevCustDue + dueDiff).toFixed(2));
        const newCustPurchases = parseFloat((prevCustPurchases + purchaseDiff).toFixed(2));
        const newCustPaid = parseFloat((prevCustPaid + paidDiff).toFixed(2));

        transaction.update(customerRef, {
          totalDue: newCustDue < 0.001 && newCustDue > -0.001 ? 0 : (newCustDue < 0 ? 0 : newCustDue),
          totalPurchases: newCustPurchases < 0 ? 0 : newCustPurchases,
          totalPaid: newCustPaid < 0 ? 0 : newCustPaid,
          updatedAt: now,
        });

        const custTxRef = doc(collection(db, CUSTOMERS_COLLECTION, originalSaleData.customerId, 'transactions'));
        transaction.set(custTxRef, {
          customerId: originalSaleData.customerId,
          type: 'adjustment',
          saleId: saleId,
          amount: finalGrandTotal,
          amountPaid: finalAmountPaid,
          dueAdded: dueDiff,
          balanceAfter: newCustDue,
          date: typeof updatedFormData.saleDate === 'string' ? updatedFormData.saleDate : now.split('T')[0],
          notes: `Sale #${saleId} edited. Total: Rs. ${finalGrandTotal.toFixed(2)}, Paid: Rs. ${finalAmountPaid.toFixed(2)}, Due difference: Rs. ${dueDiff.toFixed(2)}`,
          createdAt: now,
          recordedByEmail: userEmail,
          recordedByName: userName,
        });
      }
    });

    invalidateMemoryCache('sales');
    invalidateMemoryCache('products');
    invalidateMemoryCache('customers');
    revalidateTag('sales');
    revalidateTag('products');
    revalidateTag('customers');
    revalidatePath('/sales');
    revalidatePath('/customers');
    revalidatePath(`/sales/${saleId}`);
    revalidatePath('/dashboard');

    return { success: true, message: 'Sale updated successfully!' };
  } catch (error) {
    console.error("Error updating sale:", error);
    return { success: false, message: `Failed to update sale: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

    