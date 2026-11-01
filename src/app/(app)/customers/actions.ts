'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, CustomerTransaction, CustomerFormData, RecordCustomerPaymentPayload, Sale, PaymentTransaction } from '@/lib/types';
import { getSession } from '@/app/login/actions';
import { getFromMemoryCache, setMemoryCache, invalidateMemoryCache } from '@/lib/memory-cache';

const CUSTOMERS_COLLECTION = 'customers';
const TRANSACTIONS_SUBCOLLECTION = 'transactions';
const SALES_COLLECTION = 'sales';

const mapDocToCustomer = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): Customer => {
  const data = document.data();
  if (!data) {
    throw new Error('Customer document data is undefined.');
  }
  const nowISO = new Date().toISOString();

  return {
    id: document.id,
    name: typeof data.name === 'string' ? data.name : 'Unknown Customer',
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    address: typeof data.address === 'string' ? data.address : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    totalDue: typeof data.totalDue === 'number' ? data.totalDue : 0,
    totalPurchases: typeof data.totalPurchases === 'number' ? data.totalPurchases : 0,
    totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : 0,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : nowISO),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (typeof data.updatedAt === 'string' ? data.updatedAt : nowISO),
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : undefined,
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined,
  };
};

const mapDocToCustomerTransaction = (document: import('firebase/firestore').DocumentSnapshot | import('firebase/firestore').QueryDocumentSnapshot): CustomerTransaction => {
  const data = document.data();
  if (!data) {
    throw new Error('Customer transaction document data is undefined.');
  }
  const nowISO = new Date().toISOString();

  return {
    id: document.id,
    customerId: typeof data.customerId === 'string' ? data.customerId : '',
    type: ['sale', 'payment', 'adjustment'].includes(data.type) ? data.type : 'sale',
    saleId: typeof data.saleId === 'string' ? data.saleId : undefined,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : undefined,
    dueAdded: typeof data.dueAdded === 'number' ? data.dueAdded : 0,
    balanceAfter: typeof data.balanceAfter === 'number' ? data.balanceAfter : 0,
    paymentMethod: ['cash', 'card', 'online', 'manual_adjustment'].includes(data.paymentMethod) ? data.paymentMethod : undefined,
    date: typeof data.date === 'string' ? data.date : (data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : nowISO.split('T')[0]),
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : nowISO),
    recordedByEmail: typeof data.recordedByEmail === 'string' ? data.recordedByEmail : undefined,
    recordedByName: typeof data.recordedByName === 'string' ? data.recordedByName : undefined,
  };
};

const getCustomersCached = unstable_cache(
  async () => {
    try {
      const snap = await getDocs(collection(db, CUSTOMERS_COLLECTION));
      const list = snap.docs.map(mapDocToCustomer);
      return list.sort((a, b) => {
        if (b.totalDue !== a.totalDue) {
          return b.totalDue - a.totalDue;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching customers from Firestore:', error);
      return [];
    }
  },
  ['customers_list'],
  {
    revalidate: 3600,
    tags: ['customers'],
  }
);

export async function getCustomersAction(): Promise<Customer[]> {
  const memoryCached = getFromMemoryCache<Customer[]>('customers');
  if (memoryCached) return memoryCached;
  const list = await getCustomersCached();
  setMemoryCache('customers', list, 60);
  return list;
}

export async function getCustomerByIdAction(id: string): Promise<{ customer: Customer | null; transactions: CustomerTransaction[] }> {
  try {
    const customerRef = doc(db, CUSTOMERS_COLLECTION, id);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      return { customer: null, transactions: [] };
    }

    const customer = mapDocToCustomer(customerSnap);

    // Fetch transactions from subcollection
    const txRef = collection(db, CUSTOMERS_COLLECTION, id, TRANSACTIONS_SUBCOLLECTION);
    const txSnap = await getDocs(txRef);
    const transactions = txSnap.docs.map(mapDocToCustomerTransaction);

    // Sort transactions chronologically (newest first for display)
    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { customer, transactions };
  } catch (error) {
    console.error(`Error fetching customer ${id}:`, error);
    return { customer: null, transactions: [] };
  }
}

export async function createCustomerAction(formData: CustomerFormData): Promise<{ success: boolean; message: string; customerId?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in.' };
  }

  const name = formData.name?.trim();
  if (!name) {
    return { success: false, message: 'Customer name is required.' };
  }

  const nowISO = new Date().toISOString();

  try {
    const newDocRef = doc(collection(db, CUSTOMERS_COLLECTION));
    const customerData = {
      name: name,
      phone: formData.phone?.trim() || '',
      email: formData.email?.trim() || '',
      address: formData.address?.trim() || '',
      notes: formData.notes?.trim() || '',
      totalDue: 0,
      totalPurchases: 0,
      totalPaid: 0,
      createdAt: nowISO,
      updatedAt: nowISO,
      createdByEmail: session.email,
      createdByName: session.name,
    };

    await setDoc(newDocRef, customerData);

    invalidateMemoryCache('customers');
    revalidateTag('customers');
    revalidatePath('/customers');

    return { success: true, message: 'Customer profile created successfully.', customerId: newDocRef.id };
  } catch (error) {
    console.error('Error creating customer:', error);
    return { success: false, message: `Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function updateCustomerAction(customerId: string, formData: Partial<CustomerFormData>): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in.' };
  }

  try {
    const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (formData.name !== undefined) updateData.name = formData.name.trim();
    if (formData.phone !== undefined) updateData.phone = formData.phone.trim();
    if (formData.email !== undefined) updateData.email = formData.email.trim();
    if (formData.address !== undefined) updateData.address = formData.address.trim();
    if (formData.notes !== undefined) updateData.notes = formData.notes.trim();

    await updateDoc(customerRef, updateData);

    invalidateMemoryCache('customers');
    revalidateTag('customers');
    revalidatePath('/customers');
    revalidatePath(`/customers/${customerId}`);

    return { success: true, message: 'Customer profile updated successfully.' };
  } catch (error) {
    console.error('Error updating customer:', error);
    return { success: false, message: `Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function recordCustomerPaymentAction(payload: RecordCustomerPaymentPayload): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized: You must be logged in.' };
  }

  const { customerId, amount, paymentMethod, date, notes } = payload;
  const paymentAmount = Number(amount);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return { success: false, message: 'Payment amount must be greater than zero.' };
  }

  const nowISO = new Date().toISOString();
  const paymentDate = date || nowISO.split('T')[0];

  try {
    await runTransaction(db, async (transaction) => {
      const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
      const customerSnap = await transaction.get(customerRef);

      if (!customerSnap.exists()) {
        throw new Error('Customer profile not found.');
      }

      const customerData = mapDocToCustomer(customerSnap);
      const currentDue = customerData.totalDue || 0;
      const currentPaid = customerData.totalPaid || 0;

      const newTotalPaid = parseFloat((currentPaid + paymentAmount).toFixed(2));
      const newTotalDue = parseFloat((currentDue - paymentAmount).toFixed(2));

      // Update customer doc
      transaction.update(customerRef, {
        totalPaid: newTotalPaid,
        totalDue: newTotalDue < 0.001 && newTotalDue > -0.001 ? 0 : newTotalDue,
        updatedAt: nowISO,
      });

      // Add to transactions subcollection
      const txRef = doc(collection(db, CUSTOMERS_COLLECTION, customerId, TRANSACTIONS_SUBCOLLECTION));
      transaction.set(txRef, {
        customerId,
        type: 'payment',
        amount: paymentAmount,
        dueAdded: -paymentAmount,
        balanceAfter: newTotalDue,
        paymentMethod,
        date: paymentDate,
        notes: notes ? notes.trim() : `Due payment received by ${session.name}`,
        createdAt: nowISO,
        recordedByEmail: session.email,
        recordedByName: session.name,
      });

      // Query unpaid/partially paid sales for this customer to auto-allocate this payment
      // Note: we fetch sales for this customer to adjust sale records
    });

    // Also auto-settle the oldest sales for this customer so the sale invoices reflect this payment!
    try {
      const salesQuery = query(
        collection(db, SALES_COLLECTION),
        where('customerId', '==', customerId)
      );
      const salesSnap = await getDocs(salesQuery);
      const salesWithDue = salesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(s => (s.totalAmountDue || 0) > 0.001)
        .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());

      let remainingPaymentToAllocate = paymentAmount;
      for (const saleItem of salesWithDue) {
        if (remainingPaymentToAllocate <= 0.001) break;

        const saleRef = doc(db, SALES_COLLECTION, saleItem.id);
        const amountDueOnSale = saleItem.totalAmountDue || 0;
        const allocation = Math.min(amountDueOnSale, remainingPaymentToAllocate);

        const newSalePaid = parseFloat(((saleItem.totalPaidAmount || 0) + allocation).toFixed(2));
        const newSaleDue = parseFloat((amountDueOnSale - allocation).toFixed(2));
        const newStatus = newSaleDue <= 0.001 ? 'paid' : 'partially_paid';

        const paymentEntry: PaymentTransaction = {
          date: nowISO,
          amount: allocation,
          paymentMethod: paymentMethod as any,
          notes: notes ? `Customer due settlement: ${notes}` : `Direct customer due settlement received by ${session.name}`,
          recordedByEmail: session.email,
          recordedByName: session.name,
        };

        const existingHistory = Array.isArray(saleItem.paymentHistory) ? saleItem.paymentHistory : [];

        await updateDoc(saleRef, {
          totalPaidAmount: newSalePaid,
          totalAmountDue: newSaleDue < 0.001 ? 0 : newSaleDue,
          paymentStatus: newStatus,
          paymentHistory: [...existingHistory, paymentEntry],
          updatedAt: nowISO,
        });

        remainingPaymentToAllocate -= allocation;
      }
    } catch (allocError) {
      console.warn('Auto-allocating payment to individual sales encountered an issue:', allocError);
      // Non-fatal: customer ledger itself is already safely updated in transaction
    }

    invalidateMemoryCache('customers');
    invalidateMemoryCache('sales');
    revalidateTag('customers');
    revalidateTag('sales');
    revalidatePath('/customers');
    revalidatePath(`/customers/${customerId}`);
    revalidatePath('/sales');
    revalidatePath('/dashboard');

    return { success: true, message: `Payment of Rs. ${paymentAmount.toFixed(2)} recorded successfully.` };
  } catch (error) {
    console.error('Error recording customer payment:', error);
    return { success: false, message: `Failed to record payment: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
