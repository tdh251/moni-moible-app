import type { Ledger, Purchase, PurchaseRefund } from '../types/finance.ts';
import { ensure, money, safeAdd } from './accounting/money.ts';

const validId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const text = (value: unknown, max: number, required = false) =>
  typeof value === 'string' &&
  value.length <= max &&
  (!required || value.trim().length > 0);

export function purchaseBalances(ledger: Ledger): Map<string, number> {
  const balances = new Map(
    (ledger.purchases ?? []).map((purchase) => [purchase.id, purchase.amount]),
  );
  for (const refund of ledger.purchaseRefunds ?? [])
    balances.set(
      refund.purchase_id,
      safeAdd(balances.get(refund.purchase_id) ?? 0, -refund.amount),
    );
  return balances;
}

export function purchaseOutstanding(
  purchase: Purchase,
  refunds: PurchaseRefund[],
): number {
  return refunds
    .filter((refund) => refund.purchase_id === purchase.id)
    .reduce((sum, refund) => safeAdd(sum, -refund.amount), purchase.amount);
}

export function totalPurchaseOutstanding(ledger: Ledger): number {
  return [...purchaseBalances(ledger).values()].reduce(safeAdd, 0);
}

export function validatePurchases(ledger: Ledger): void {
  const accounts = new Set(ledger.accounts.map((account) => account.id));
  const purchases = new Map<string, Purchase>();
  let total = 0;
  for (const purchase of ledger.purchases ?? []) {
    ensure(
      validId(purchase.id) && !purchases.has(purchase.id),
      'ID mua hộ không hợp lệ hoặc bị trùng.',
    );
    ensure(
      text(purchase.title, 200, true),
      'Nhập nội dung mua hộ từ 1 đến 200 ký tự.',
    );
    ensure(
      text(purchase.person, 100, true),
      'Nhập người được mua hộ từ 1 đến 100 ký tự.',
    );
    ensure(text(purchase.note, 4000), 'Ghi chú mua hộ tối đa 4.000 ký tự.');
    money(purchase.amount);
    total = safeAdd(total, purchase.amount);
    ensure(
      accounts.has(purchase.account_id),
      'Tài khoản mua hộ không tồn tại.',
    );
    ensure(
      validDate(purchase.occurred_at) &&
        validDate(purchase.created_at) &&
        validDate(purchase.updated_at),
      'Thời gian mua hộ không hợp lệ.',
    );
    ensure(
      purchase.due_at === null ||
        (validDate(purchase.due_at) && purchase.due_at >= purchase.occurred_at),
      'Hạn hoàn tiền phải từ ngày mua hộ trở đi.',
    );
    purchases.set(purchase.id, purchase);
  }
  const refundIds = new Set<string>();
  const paid = new Map<string, number>();
  for (const refund of ledger.purchaseRefunds ?? []) {
    ensure(
      validId(refund.id) && !refundIds.has(refund.id),
      'ID hoàn tiền không hợp lệ hoặc bị trùng.',
    );
    refundIds.add(refund.id);
    const purchase = purchases.get(refund.purchase_id);
    ensure(purchase, 'Khoản mua hộ cần hoàn không tồn tại.');
    ensure(
      accounts.has(refund.account_id),
      'Tài khoản nhận hoàn tiền không tồn tại.',
    );
    ensure(text(refund.note, 4000), 'Ghi chú hoàn tiền tối đa 4.000 ký tự.');
    ensure(
      validDate(refund.occurred_at) &&
        validDate(refund.created_at) &&
        refund.occurred_at >= purchase.occurred_at,
      'Ngày hoàn tiền phải từ thời điểm mua hộ trở đi.',
    );
    money(refund.amount);
    const sum = safeAdd(paid.get(purchase.id) ?? 0, refund.amount);
    ensure(
      sum <= purchase.amount,
      'Tiền hoàn vượt quá số tiền mua hộ còn chờ hoàn.',
    );
    paid.set(purchase.id, sum);
  }
}

// These flows affect wallets only. They never enter income/expense reports.
export function purchaseCashFlows(ledger: Ledger) {
  const purchases = new Map(
    (ledger.purchases ?? []).map((purchase) => [purchase.id, purchase]),
  );
  return [
    ...(ledger.purchases ?? []).map((purchase) => ({
      id: `purchase:${purchase.id}`,
      purchase_id: purchase.id,
      account_id: purchase.account_id,
      amount: purchase.amount,
      note: purchase.note,
      occurred_at: purchase.occurred_at,
      created_at: purchase.created_at,
      exclude_from_balance: 0 as const,
      title: `Mua hộ ${purchase.person} · ${purchase.title}`,
      source_account_id: purchase.account_id as string | null,
      destination_account_id: null as string | null,
    })),
    ...(ledger.purchaseRefunds ?? []).map((refund) => ({
      id: `purchase-refund:${refund.id}`,
      purchase_id: refund.purchase_id,
      account_id: refund.account_id,
      amount: refund.amount,
      note: refund.note,
      occurred_at: refund.occurred_at,
      created_at: refund.created_at,
      exclude_from_balance: 0 as const,
      title: `Hoàn tiền mua hộ · ${purchases.get(refund.purchase_id)?.person ?? ''}`,
      source_account_id: null as string | null,
      destination_account_id: refund.account_id as string | null,
    })),
  ];
}
