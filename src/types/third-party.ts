export type ThirdPartyStatus =
  'pending' | 'in_progress' | 'fulfilled' | 'completed' | 'cancelled';
export type ThirdPartyFinancialStatus = 'holding' | 'receivable' | 'balanced';
export type ThirdPartyEntryKind =
  | 'receive'
  | 'payment'
  | 'refund'
  | 'reimbursement'
  | 'payment_refund'
  | 'settlement_income'
  | 'settlement_expense';

export interface ThirdPartyCase {
  id: string;
  title: string;
  person: string;
  description: string;
  expected_amount: number | null;
  started_at: string;
  due_at: string | null;
  note: string;
  tag_ids_json: string;
  status: ThirdPartyStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
}

export interface ThirdPartyEntry {
  id: string;
  case_id: string;
  kind: ThirdPartyEntryKind;
  amount: number;
  account_id: string | null;
  category_id: string | null;
  related_entry_id: string | null;
  settlement_id: string | null;
  tag_ids_json: string;
  note: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  sequence: number;
}
export type ThirdPartyEntryInput = Omit<ThirdPartyEntry, 'sequence'>;

export interface ThirdPartySettlementRequest {
  id: string;
  case_id: string;
  cash_amount: number;
  personal_amount: number;
  account_id: string | null;
  category_id: string | null;
  tag_ids_json: string;
  note: string;
  occurred_at: string;
  complete_case: boolean;
}
// The journal persists after undo, so a retry cannot recreate an undone payment.
export interface ThirdPartySettlement {
  id: string;
  case_id: string;
  request_json: string;
  created_at: string;
  undone_at: string | null;
}
