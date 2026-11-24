import type { Ledger, Transaction } from '../types/finance.ts';
import { createCategoryPathResolver } from './categories/hierarchy.ts';
import { isThirdPartyPersonal } from './third-party.ts';

export function createTransactionListIndex(ledger: Ledger) {
  const categoryPath = createCategoryPathResolver(ledger.categories);
  const itemCounts = new Map<string, number>();
  for (const item of ledger.items)
    itemCounts.set(
      item.transaction_id,
      (itemCounts.get(item.transaction_id) ?? 0) + 1,
    );
  return {
    thirdPartyReportCases: new Map(
      (ledger.thirdPartyEntries ?? [])
        .filter((entry) => isThirdPartyPersonal(entry.kind))
        .map((entry) => [`third-party-report:${entry.id}`, entry.case_id]),
    ),
    accountNames: new Map(
      ledger.accounts.map((account) => [account.id, account.name]),
    ),
    categories: new Map(
      ledger.categories.map((category) => [category.id, category]),
    ),
    categoryNames: new Map(
      ledger.categories.map((category) => [
        category.id,
        categoryPath(category.id),
      ]),
    ),
    tags: new Map((ledger.tags ?? []).map((tag) => [tag.id, tag])),
    itemCounts,
  };
}
export type TransactionListIndex = ReturnType<
  typeof createTransactionListIndex
>;

export function groupTransactionsByDay(transactions: Transaction[]) {
  const dayFormatter = new Intl.DateTimeFormat('vi-VN');
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const day = dayFormatter.format(new Date(transaction.occurred_at));
    const group = groups.get(day);
    if (group) group.push(transaction);
    else groups.set(day, [transaction]);
  }
  return [...groups].map(([title, data]) => ({ title, data }));
}

export function recentTransactionSections(
  transactions: Transaction[],
  now: Date,
) {
  const formatter = new Intl.DateTimeFormat('vi-VN');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  const start = new Date(today);
  start.setDate(start.getDate() - 2);
  const days = new Map<
    string,
    { key: string; title: string; data: Transaction[] }
  >();
  for (let offset = 0; offset < 3; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const date = formatter.format(day);
    days.set(date, {
      key: String(day.getTime()),
      title:
        offset === 0
          ? `Hôm nay · ${date}`
          : offset === 1
            ? `Hôm qua · ${date}`
            : date,
      data: [],
    });
  }
  for (const transaction of transactions) {
    const date = new Date(transaction.occurred_at);
    if (date.getTime() >= start.getTime() && date.getTime() < end.getTime())
      days.get(formatter.format(date))?.data.push(transaction);
  }
  return [...days.values()]
    .filter((section) => section.data.length > 0)
    .map((section) => ({
      ...section,
      data: section.data.sort(
        (a, b) =>
          b.occurred_at.localeCompare(a.occurred_at) ||
          b.created_at.localeCompare(a.created_at) ||
          b.id.localeCompare(a.id),
      ),
    }));
}
