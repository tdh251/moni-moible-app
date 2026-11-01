import { loanCashFlows, validateLoans } from '../loans.ts';
import { transactionTagIds, validateTags } from '../tags.ts';
import {
  itemCategoryIds,
  transactionCategoryTags,
} from '../categories/tags.ts';
import {
  categoryDescendants,
  categoryHierarchyError,
} from '../categories/hierarchy.ts';
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
    tags?: Map<string, import('../../types/finance.ts').Tag>;
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
  const previousTagIds = active
    ? new Set(
        transactionTagIds(
          ledger.transactions.find((old) => old.id === t.id) ?? {},
        ),
      )
    : new Set<string>();
  for (const id of transactionTagIds(t)) {
    const tag = lookup?.tags
      ? lookup.tags.get(id)
      : (ledger.tags ?? []).find((tag) => tag.id === id);
    ensure(
      tag && (!active || !tag.is_archived || previousTagIds.has(id)),
      'Tag không tồn tại hoặc đã lưu trữ. Hãy chọn lại tag.',
    );
  }
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
  const tags = transactionCategoryTags(t);
  if (active)
    ensure(
      t.category_split !== 1 && tags.length <= (items.length ? 0 : 1),
      'Mỗi giao dịch chỉ được chọn một danh mục.',
    );
  if (tags.length) {
    ensure(t.type !== 'transfer', 'Chuyển nội bộ không có nhãn danh mục.');
    for (const id of tags) category(id, t.type as 'income' | 'expense');
    ensure(
      t.category_split === 1 ||
        (t.type === 'expense' && items.length > 0 && t.category_id === null) ||
        (items.length === 0 && t.category_id === tags[0]),
      'Danh mục chung của giao dịch không hợp lệ.',
    );
    if (t.category_split === 1)
      ensure(
        tags.length === items.length &&
          tags.every((id) => items.some((i) => i.category_id === id)),
        'Nhãn danh mục cũ phải khớp các mục đã lưu.',
      );
  }
  const split = t.category_split === 1;
  ensure(
    t.category_split === undefined || t.category_split === 0 || split,
    'Trạng thái nhiều danh mục phải là 0 hoặc 1.',
  );
  if (split) {
    ensure(
      t.type !== 'transfer' && items.length >= 2,
      'Chọn ít nhất hai danh mục cho giao dịch thu hoặc chi.',
    );
    ensure(
      !adjustments.length,
      'Phân bổ danh mục không có điều chỉnh hóa đơn.',
    );
    ensure(
      new Set(items.map((i) => i.category_id)).size === items.length,
      'Mỗi danh mục chỉ được phân bổ một lần.',
    );
  }
  if (t.type === 'income') {
    ensure(
      t.source_account_id === null && (split || items.length === 0),
      'Thu chỉ có tài khoản nhận; nhiều danh mục phải dùng chế độ phân bổ.',
    );
    account(t.destination_account_id);
    // Keep the first income category as the required SQL reference; item amounts drive reporting.
    if (split)
      ensure(
        t.category_id === items[0].category_id,
        'Danh mục thu chính phải khớp mục phân bổ đầu tiên.',
      );
    else category(t.category_id, 'income');
  } else if (t.type === 'expense') {
    ensure(t.destination_account_id === null, 'Chi chỉ có tài khoản nguồn.');
    account(t.source_account_id);
    if (items.length)
      ensure(
        t.category_id === null,
        'Giao dịch nhiều mục dùng danh mục của từng mục.',
      );
    else category(t.category_id, 'expense');
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
  if (items.length && t.type !== 'transfer') {
    for (const item of items) {
      ensure(
        item.transaction_id === t.id &&
          item.name.trim().length > 0 &&
          item.name.length <= 200,
        'Tên mục phân bổ không hợp lệ.',
      );
      money(item.amount);
      const previousItem = active
        ? ledger.items.find(
            (old) => old.id === item.id && old.transaction_id === t.id,
          )
        : undefined;
      const previousTags = new Set(
        previousItem ? transactionTagIds(previousItem) : [],
      );
      const itemTags = transactionTagIds(item);
      ensure(
        !split || itemTags.length === 0,
        'Tag mục chi chỉ dùng cho hóa đơn nhiều mục.',
      );
      for (const id of itemTags) {
        const tag = lookup?.tags
          ? lookup.tags.get(id)
          : ledger.tags?.find((tag) => tag.id === id);
        ensure(
          tag && (!active || !tag.is_archived || previousTags.has(id)),
          'Tag mục chi không tồn tại hoặc đã lưu trữ.',
        );
      }
      const itemCategories = itemCategoryIds(item);
      if (active)
        ensure(
          itemCategories.length === 1,
          'Mỗi mục chi chỉ được chọn một danh mục.',
        );
      ensure(
        itemCategories[0] === item.category_id,
        'Danh mục chính phải khớp danh mục đầu tiên của mục chi.',
      );
      ensure(
        !split || transactionCategoryTags(item).length === 0,
        'Phân bổ cũ không có nhãn danh mục mục chi.',
      );
      for (const id of itemCategories) category(id, t.type);
    }
    ensure(
      calculateReceipt(items, adjustments).total === t.amount,
      split
        ? 'Tổng tiền các danh mục phải bằng số tiền giao dịch.'
        : 'Tổng các mục và điều chỉnh phải bằng tổng hóa đơn.',
    );
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
  const sorted = [...ledger.transactions, ...loanCashFlows(ledger)].sort(
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
  validateLoans(ledger);
  validateTags(ledger.tags ?? []);
  const hierarchyError = categoryHierarchyError(ledger.categories);
  ensure(!hierarchyError, hierarchyError ?? 'Cấu trúc danh mục không hợp lệ.');
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
    tags: new Map((ledger.tags ?? []).map((t) => [t.id, t])),
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
  const selectedTags = new Set(filters.tags ?? []);
  const categories = categoryFilterIds(filters, ledger.categories);
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
      .filter((i) => itemCategoryIds(i).some((id) => categories.has(id)))
      .map((i) => i.transaction_id),
  );
  const itemTagMatches = new Set(
    ledger.items
      .filter((item) =>
        transactionTagIds(item).some((id) => selectedTags.has(id)),
      )
      .map((item) => item.transaction_id),
  );
  return ledger.transactions
    .filter((t) => {
      const date = new Date(t.occurred_at);
      return (
        date >= start &&
        date < end &&
        (!filters.type || t.type === filters.type) &&
        (!selectedTags.size ||
          transactionTagIds(t).some((id) => selectedTags.has(id)) ||
          itemTagMatches.has(t.id)) &&
        (!accounts.size ||
          accounts.has(t.source_account_id ?? '') ||
          accounts.has(t.destination_account_id ?? '')) &&
        (!categories.size ||
          categories.has(t.category_id ?? '') ||
          transactionCategoryTags(t).some((id) => categories.has(id)) ||
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
  const selectedCategories = categoryFilterIds(filters, ledger.categories);
  const selectedTags = new Set(filters.tags ?? []);
  let income = 0;
  let expense = 0;
  const categories = new Map<string, number>();
  const tags = new Map<
    string,
    { income: number; expense: number; count: number }
  >();
  const addTagAmounts = (
    t: Transaction,
    amount: number,
    items: { amount: number; tag_ids_json?: string }[] = [],
  ) => {
    const parentTags = new Set(transactionTagIds(t));
    const values = new Map([...parentTags].map((id) => [id, amount]));
    for (const item of items)
      for (const id of transactionTagIds(item))
        if (!parentTags.has(id))
          values.set(id, safeAdd(values.get(id) ?? 0, item.amount));
    for (const [id, value] of values) {
      const row = tags.get(id) ?? { income: 0, expense: 0, count: 0 };
      if (t.type === 'income') row.income = safeAdd(row.income, value);
      if (t.type === 'expense') row.expense = safeAdd(row.expense, value);
      row.count += 1;
      tags.set(id, row);
    }
  };
  const categoryTotals = new Map<string, number>();
  const byCategory = new Map(ledger.categories.map((c) => [c.id, c]));
  const ancestors = (id: string) => {
    const result = new Set<string>();
    let current: string | null = id;
    while (current && !result.has(current)) {
      result.add(current);
      current = byCategory.get(current)?.parent_id ?? null;
    }
    return result;
  };
  let hasCategoryTags = false;
  const grouped = groupItems(ledger);
  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const tags = transactionCategoryTags(t);
    const storedItems = grouped.get(t.id) ?? [];
    const receiptAllocation = storedItems.length
      ? calculateReceipt(storedItems, parseAdjustments(t.adjustments_json))
      : null;
    const parentMatchesTag =
      !selectedTags.size ||
      transactionTagIds(t).some((id) => selectedTags.has(id));
    const taggedItems = storedItems
      .map((item, index) => ({
        ...item,
        amount: receiptAllocation!.itemAmounts[index],
      }))
      .filter(
        (item) =>
          parentMatchesTag ||
          transactionTagIds(item).some((id) => selectedTags.has(id)),
      );
    if (storedItems.length && t.category_split !== 1) {
      hasCategoryTags ||=
        tags.length > 0 ||
        storedItems.some((item) => itemCategoryIds(item).length > 1);
      const categoryWide =
        !selectedCategories.size ||
        tags.some((id) => selectedCategories.has(id));
      const reportedItems = taggedItems.filter(
        (item) =>
          categoryWide ||
          itemCategoryIds(item).some((id) => selectedCategories.has(id)),
      );
      const amount = reportedItems.reduce(
        (sum, item) => safeAdd(sum, item.amount),
        0,
      );
      addTagAmounts(t, amount, reportedItems);
      expense = safeAdd(expense, amount);
      const amounts = new Map<string, number>();
      const inclusive = new Map<string, number>();
      for (const item of taggedItems) {
        const itemAncestors = new Set<string>();
        for (const id of itemCategoryIds(item)) {
          if (selectedCategories.size && !selectedCategories.has(id)) continue;
          amounts.set(id, safeAdd(amounts.get(id) ?? 0, item.amount));
          for (const parent of ancestors(id)) itemAncestors.add(parent);
        }
        for (const id of itemAncestors)
          inclusive.set(id, safeAdd(inclusive.get(id) ?? 0, item.amount));
      }
      const eligibleTotal = taggedItems.reduce(
        (sum, item) => safeAdd(sum, item.amount),
        0,
      );
      // Historical receipt-wide labels stay readable until the receipt is edited.
      for (const id of tags) {
        if (selectedCategories.size && !selectedCategories.has(id)) continue;
        amounts.set(id, eligibleTotal);
        for (const parent of ancestors(id))
          inclusive.set(parent, eligibleTotal);
      }
      for (const [id, value] of amounts)
        categories.set(id, safeAdd(categories.get(id) ?? 0, value));
      for (const [id, value] of inclusive)
        categoryTotals.set(id, safeAdd(categoryTotals.get(id) ?? 0, value));
      continue;
    }
    if (tags.length) {
      hasCategoryTags = true;
      addTagAmounts(t, t.amount);
      if (t.type === 'income') income = safeAdd(income, t.amount);
      else expense = safeAdd(expense, t.amount);
      const inclusive = new Set<string>();
      for (const id of tags) {
        if (selectedCategories.size && !selectedCategories.has(id)) continue;
        categories.set(id, safeAdd(categories.get(id) ?? 0, t.amount));
        for (const parent of ancestors(id)) inclusive.add(parent);
      }
      for (const id of inclusive)
        categoryTotals.set(id, safeAdd(categoryTotals.get(id) ?? 0, t.amount));
      continue;
    }
    const items = taggedItems;
    const amount = storedItems.length
      ? items
          .filter(
            (i) =>
              !selectedCategories.size || selectedCategories.has(i.category_id),
          )
          .reduce((sum, i) => safeAdd(sum, i.amount), 0)
      : t.amount;
    addTagAmounts(
      t,
      amount,
      items.filter(
        (item) =>
          !selectedCategories.size || selectedCategories.has(item.category_id),
      ),
    );
    if (t.type === 'income') income = safeAdd(income, amount);
    else expense = safeAdd(expense, amount);
    if (items.length) {
      for (const i of items) {
        if (!selectedCategories.size || selectedCategories.has(i.category_id)) {
          categories.set(
            i.category_id,
            safeAdd(categories.get(i.category_id) ?? 0, i.amount),
          );
          for (const id of ancestors(i.category_id))
            categoryTotals.set(
              id,
              safeAdd(categoryTotals.get(id) ?? 0, i.amount),
            );
        }
      }
    } else if (t.category_id) {
      categories.set(
        t.category_id,
        safeAdd(categories.get(t.category_id) ?? 0, t.amount),
      );
      for (const id of ancestors(t.category_id))
        categoryTotals.set(id, safeAdd(categoryTotals.get(id) ?? 0, t.amount));
    }
  }
  return {
    income,
    expense,
    net: safeAdd(income, -expense),
    tags: Object.fromEntries(tags) as Record<
      string,
      { income: number; expense: number; count: number }
    >,
    hasCategoryTags,
    categoryTotals: Object.fromEntries(categoryTotals) as Record<
      string,
      number
    >,
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

function categoryFilterIds(
  filters: Filters,
  categories: Category[],
): Set<string> {
  return categoryDescendants(
    categories,
    filters.categories?.length
      ? filters.categories
      : filters.category
        ? [filters.category]
        : [],
  );
}
