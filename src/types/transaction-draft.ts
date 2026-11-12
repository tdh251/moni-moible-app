import type { TransactionType } from './finance';

export interface TransactionFormValues {
  type: TransactionType;
  title: string;
  amount: string;
  source: string;
  destination: string;
  occurred_at: string;
  excludeFromBalance: boolean;
  tagIds: string[];
  note: string;
  mode: 'categories' | 'items';
  allocations: { id: string; category: string; amount: string }[];
  adjustments: {
    id: string;
    name: string;
    mode: 'percent' | 'fixed';
    percent: string;
    amount: string;
  }[];
  items: {
    id: string;
    name: string;
    amount: string;
    category: string;
    categoryIds: string[];
    tagIds: string[];
  }[];
}

export interface SavedTransactionDraft {
  id: string;
  values: TransactionFormValues;
  created_at: string;
  updated_at: string;
}
