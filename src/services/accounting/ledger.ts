import type {
  Account,
  Category,
  Filters,
  Ledger,
  Period,
  Transaction,
  TransactionDraft,
} from '../../types/finance.ts';

import { ensure, money, safeAdd } from './money.ts';
import { calculateReceipt, parseAdjustments } from './receipt.ts';
export { FinanceError, ensure, money, safeAdd, parseAmount } from './money.ts';
export function validDate(value: string): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
export function validateTransaction(
  t: Transaction,
  items: Ledger['items'],
  ledger: Ledger,
  active = false,
  lookup?: {
    accounts: Map<string, Account>;
    categories: Map<string, Category>;
  },
): void {
  ensure(
    ['income', 'expense', 'transfer'].includes(t.type),
    'Loại giao dịch không hợp lệ.',
  );
  money(t.amount);
  ensure(
    t.exclude_from_balance === undefined ||
      t.exclude_from_balance === 0 ||
      t.exclude_from_balance === 1,
    'Trạng thái không tính vào số dư phải là 0 hoặc 1.',
  );
  const adjustments = parseAdjustments(t.adjustments_json);
  ensure(
    !adjustments.length || (t.type === 'expense' && items.length > 0),
    'Chỉ hóa đơn nhiều mục mới có điều chỉnh hóa đơn.',
  );
  ensure(
    t.title.trim().length > 0 && t.title.length <= 200,
    'Nhập tiêu đề từ 1 đến 200 ký tự.',
  );
  ensure(t.note.length <= 4000, 'Ghi chú tối đa 4.000 ký tự.');
  ensure(
    validDate(t.occurred_at) &&
      validDate(t.created_at) &&
      validDate(t.updated_at),
    'Ngày giờ không hợp lệ.',
  );
  const account = (id: string | null) => {
    const a = lookup
      ? lookup.accounts.get(id ?? '')
      : ledger.accounts.find((x) => x.id === id);
    ensure(
      a && (!active || !a.is_archived),
      'Tài khoản không tồn tại hoặc đã lưu trữ.',
    );
  };
  const category = (id: string | null, type: 'income' | 'expense') => {
    const c = lookup
      ? lookup.categories.get(id ?? '')
      : ledger.categories.find((x) => x.id === id);
    ensure(
      c && c.type === type && (!active || !c.is_archived),
      'Danh mục không đúng loại hoặc đã lưu trữ.',
    );
  };
  if (t.type === 'income') {
    ensure(
      t.source_account_id === null && items.length === 0,
      'Thu chỉ có tài khoản nhận, không có mục chi.',
    );
    account(t.destination_account_id);
    category(t.category_id, 'income');
  } else if (t.type === 'expense') {
    ensure(t.destination_account_id === null, 'Chi chỉ có tài khoản nguồn.');
    account(t.source_account_id);
    if (items.length) {
      ensure(
        t.category_id === null,
        'Hóa đơn nhiều mục dùng danh mục của từng mục.',
      );
      for (const item of items) {
        ensure(
          item.transaction_id === t.id &&
            item.name.trim().length > 0 &&
            item.name.length <= 200,
          'Tên mục chi không hợp lệ.',
        );
        money(item.amount);
        category(item.category_id, 'expense');
      }
      ensure(
        calculateReceipt(items, adjustments).total === t.amount,
        'Tổng các mục và điều chỉnh phải bằng tổng hóa đơn.',
      );
    } else category(t.category_id, 'expense');
  } else {
    ensure(
      t.source_account_id !== t.destination_account_id,
      'Tài khoản nguồn và nhận phải khác nhau.',
    );
    ensure(
      t.category_id === null && items.length === 0,
      'Chuyển nội bộ không có danh mục hoặc mục chi.',
    );
    account(t.source_account_id);
    account(t.destination_account_id);
  }
}
export function accountBalances(ledger: Ledger): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(
    ledger.accounts.map((a) => [a.id, a.opening_balance]),
  );
  for (const a of ledger.accounts) {
    money(a.opening_balance, true);
    result[a.id] = a.opening_balance;
  }
  const sorted = [...ledger.transactions].sort(
    (a, b) =>
      a.occurred_at.localeCompare(b.occurred_at) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
  for (const t of sorted) {
    if (t.exclude_from_balance === 1) continue;
    if (t.source_account_id) {
      const id = t.source_account_id;
      result[id] = safeAdd(result[id], -t.amount);
      ensure(
        result[id] >= 0,
        `Không đủ số dư tại giao dịch “${t.title}” (${new Date(t.occurred_at).toLocaleDateString('vi-VN')}).`,
      );
    }
    if (t.destination_account_id)
      result[t.destination_account_id] = safeAdd(
        result[t.destination_account_id],
        t.amount,
      );
  }
  Object.values(result).reduce(safeAdd, 0);
  return result;
}
export function validateLedger(ledger: Ledger): void {
  for (const a of ledger.accounts) {
    ensure(
      a.name.trim().length > 0 && a.name.length <= 100,
      'Tên tài khoản từ 1 đến 100 ký tự.',
    );
    money(a.opening_balance, true);
  }
  const grouped = groupItems(ledger);
  const transactionIds = new Set(ledger.transactions.map((t) => t.id));
  const lookup = {
    accounts: new Map(ledger.accounts.map((a) => [a.id, a])),
    categories: new Map(ledger.categories.map((c) => [c.id, c])),
  };
  let lifetimeIncome = 0;
  let lifetimeExpense = 0;
  for (const t of ledger.transactions) {
    validateTransaction(t, grouped.get(t.id) ?? [], ledger, false, lookup);
    // Bound gross reports as well as account balances to safe integer VND.
    if (t.type === 'income') lifetimeIncome = safeAdd(lifetimeIncome, t.amount);
    if (t.type === 'expense')
      lifetimeExpense = safeAdd(lifetimeExpense, t.amount);
  }
  ensure(
    ledger.items.every((i) => transactionIds.has(i.transaction_id)),
    'Mục chi thiếu giao dịch.',
  );
  accountBalances(ledger);
}
export function replaceTransaction(
  ledger: Ledger,
  draft: TransactionDraft,
): Ledger {
  validateTransaction(draft, draft.items, ledger, true);
  const { items, ...transaction } = draft;
  const next = {
    ...ledger,
    transactions: [
      ...ledger.transactions.filter((t) => t.id !== draft.id),
      transaction,
    ],
    items: [
      ...ledger.items.filter((i) => i.transaction_id !== draft.id),
      ...items,
    ],
  };
  validateLedger(next);
  return next;
}
export function removeTransaction(ledger: Ledger, id: string): Ledger {
  const next = {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== id),
    items: ledger.items.filter((i) => i.transaction_id !== id),
  };
  validateLedger(next);
  return next;
}
export function changeOpening(
  ledger: Ledger,
  id: string,
  amount: number,
): Ledger {
  money(amount, true);
  ensure(
    ledger.accounts.some((a) => a.id === id && !a.is_archived),
    'Không thể đổi số dư tài khoản này.',
  );
  const next = {
    ...ledger,
    accounts: ledger.accounts.map((a) =>
      a.id === id ? { ...a, opening_balance: amount } : a,
    ),
  };
  validateLedger(next);
  return next;
}
export function periodRange(date: string, period: Period): [Date, Date] {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (period === 'day')
    return [
      new Date(year, month, d.getDate()),
      new Date(year, month, d.getDate() + 1),
    ];
  if (period === 'year')
    return [new Date(year, 0, 1), new Date(year + 1, 0, 1)];
  const start = period === 'quarter' ? Math.floor(month / 3) * 3 : month;
  return [
    new Date(year, start, 1),
    new Date(year, start + (period === 'quarter' ? 3 : 1), 1),
  ];
}
export function shiftPeriod(
  date: string,
  period: Period,
  direction: number,
): string {
  const [d] = periodRange(date, period);
  if (period === 'day') d.setDate(d.getDate() + direction);
  else if (period === 'year') d.setFullYear(d.getFullYear() + direction);
  else d.setMonth(d.getMonth() + direction * (period === 'quarter' ? 3 : 1));
  return d.toISOString();
}
export function filterTransactions(
  ledger: Ledger,
  filters: Filters,
): Transaction[] {
  const [start, end] = periodRange(filters.date, filters.period);
  const search = filters.search.trim().toLocaleLowerCase('vi-VN');
  const accounts = new Set(
    filters.accounts?.length
      ? filters.accounts
      : filters.account
        ? [filters.account]
        : [],
  );
  const categories = categoryFilterIds(filters);
  if (filters.minAmount !== undefined) money(filters.minAmount, true);
  if (filters.maxAmount !== undefined) money(filters.maxAmount, true);
  ensure(
    filters.minAmount === undefined ||
      filters.maxAmount === undefined ||
      filters.minAmount <= filters.maxAmount,
    'Số tiền từ phải nhỏ hơn hoặc bằng số tiền đến.',
  );
  const categoryMatches = new Set(
    ledger.items
      .filter((i) => categories.has(i.category_id))
      .map((i) => i.transaction_id),
  );
  return ledger.transactions
    .filter((t) => {
      const date = new Date(t.occurred_at);
      return (
        date >= start &&
        date < end &&
        (!filters.type || t.type === filters.type) &&
        (!accounts.size ||
          accounts.has(t.source_account_id ?? '') ||
          accounts.has(t.destination_account_id ?? '')) &&
        (!categories.size ||
          categories.has(t.category_id ?? '') ||
          categoryMatches.has(t.id)) &&
        (filters.minAmount === undefined || t.amount >= filters.minAmount) &&
        (filters.maxAmount === undefined || t.amount <= filters.maxAmount) &&
        (!search ||
          `${t.title} ${t.note}`.toLocaleLowerCase('vi-VN').includes(search))
      );
    })
    .sort(
      (a, b) =>
        b.occurred_at.localeCompare(a.occurred_at) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
}
export function statistics(ledger: Ledger, filters: Filters) {
  const transactions = filterTransactions(ledger, filters);
  const selectedCategories = categoryFilterIds(filters);
  let income = 0;
  let expense = 0;
  const categories = new Map<string, number>();
  const grouped = groupItems(ledger);
  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const storedItems = grouped.get(t.id) ?? [];
    const allocation = storedItems.length
      ? calculateReceipt(storedItems, parseAdjustments(t.adjustments_json))
      : null;
    const items = storedItems.map((item, index) => ({
      ...item,
      amount: allocation!.itemAmounts[index],
    }));
    const amount =
      selectedCategories.size && items.length
        ? items
            .filter((i) => selectedCategories.has(i.category_id))
            .reduce((sum, i) => safeAdd(sum, i.amount), 0)
        : t.amount;
    if (t.type === 'income') income = safeAdd(income, amount);
    else expense = safeAdd(expense, amount);
    if (items.length)
      for (const i of items) {
        if (!selectedCategories.size || selectedCategories.has(i.category_id))
          categories.set(
            i.category_id,
            safeAdd(categories.get(i.category_id) ?? 0, i.amount),
          );
      }
    else if (t.category_id)
      categories.set(
        t.category_id,
        safeAdd(categories.get(t.category_id) ?? 0, t.amount),
      );
  }
  return {
    income,
    expense,
    net: safeAdd(income, -expense),
    categories: Object.fromEntries(categories) as Record<string, number>,
    transactions,
  };
}
export function totalBalance(
  accounts: Account[],
  balances: Record<string, number>,
): number {
  return accounts.reduce((sum, a) => safeAdd(sum, balances[a.id] ?? 0), 0);
}
function groupItems(ledger: Ledger): Map<string, Ledger['items']> {
  const grouped = new Map<string, Ledger['items']>();
  for (const item of ledger.items) {
    const group = grouped.get(item.transaction_id);
    if (group) group.push(item);
    else grouped.set(item.transaction_id, [item]);
  }
  return grouped;
}

function categoryFilterIds(filters: Filters): Set<string> {
  return new Set(
    filters.categories?.length
      ? filters.categories
      : filters.category
        ? [filters.category]
        : [],
  );
}
