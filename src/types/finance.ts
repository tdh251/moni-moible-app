export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = Exclude<TransactionType, 'transfer'>;
export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank';
  opening_balance: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sort_order: number;
  is_archived: number;
}
export interface Transaction {
  adjustments_json?: string;
  exclude_from_balance?: 0 | 1;
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  category_id: string | null;
  note: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}
interface ReceiptAdjustmentBase {
  id: string;
  name: string;
}
export type ReceiptAdjustment = ReceiptAdjustmentBase &
  (
    | { kind?: 'percent'; rate_bps: number; amount_vnd?: never }
    | { kind: 'fixed'; amount_vnd: number; rate_bps?: never }
  );
export interface TransactionItem {
  id: string;
  transaction_id: string;
  name: string;
  amount: number;
  category_id: string;
  sort_order: number;
}
export interface Ledger {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  items: TransactionItem[];
}
export interface Snapshot extends Ledger {
  onboarded: boolean;
}
export interface TransactionDraft extends Transaction {
  items: TransactionItem[];
}
export type Period = 'day' | 'month' | 'quarter' | 'year';
export interface Filters {
  period: Period;
  date: string;
  account: string;
  category: string;
  accounts?: string[];
  categories?: string[];
  minAmount?: number;
  maxAmount?: number;
  type: TransactionType | '';
  search: string;
}
