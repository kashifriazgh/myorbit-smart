'use client';
import React from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Expenditure } from '@/app/lib/interface';

export const handleSaveExpense = async (
  {
    userId,
    title,
    amount,
    type,
    frequency,
    category,
    isPaid,
    notes,
    dueDate,
  }: {
    userId: string;
    title: string;
    amount: number | '';
    type: 'one-time' | 'recurring';
    frequency: 'daily' | 'weekly' | 'monthly' | 'one_time';
    category: string;
    isPaid: boolean;
    notes: string;
    dueDate: Date | null;
  },
  setExpenditures: React.Dispatch<React.SetStateAction<Expenditure[]>>,
  setSaving: React.Dispatch<React.SetStateAction<boolean>>,
  resetForm: () => void
) => {
  if (!title || !amount) return;
  setSaving(true);
  const now = new Date();
  const newExp: Expenditure = {
    userId,
    title,
    amount: Number(amount),
    type,
    frequency,
    category,
    isPaid,
    notes,
    dueDate: dueDate ?? new Date(),
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(collection(db, 'expenditures'), {
    ...newExp,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  setExpenditures((prev: Expenditure[]) => [
    ...prev,
    { ...newExp, id: ref.id },
  ]);
  setSaving(false);
  resetForm();
};

export const handleDeleteExpense = async (
  deleteId: string,
  setExpenditures: React.Dispatch<React.SetStateAction<Expenditure[]>>,
  setDeleting: React.Dispatch<React.SetStateAction<boolean>>,
  setDeleteId: React.Dispatch<React.SetStateAction<string | null>>
) => {
  if (!deleteId) return;
  setDeleting(true);
  await deleteDoc(doc(db, 'expenditures', deleteId));
  setExpenditures((prev: Expenditure[]) =>
    prev.filter((e) => e.id !== deleteId)
  );
  setDeleting(false);
  setDeleteId(null);
};

export const handleAmountUpdate = async (
  id: string,
  newAmount: number,
  setAmountUpdatingId: React.Dispatch<React.SetStateAction<string | null>>
) => {
  setAmountUpdatingId(id);
  const ref = doc(db, 'expenditures', id);
  await updateDoc(ref, { amount: newAmount, updatedAt: serverTimestamp() });
  setAmountUpdatingId(null);
};
