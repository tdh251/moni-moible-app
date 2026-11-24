import type { Ledger } from '../types/finance.ts';
import { safeAdd } from './accounting/money.ts';
import { loanBalances, loanMonthlyPayment } from './loans.ts';
import { purchaseBalances } from './purchases.ts';

export type DebtSide = 'receivable' | 'payable';
export type DebtKind = 'lend' | 'borrow' | 'purchase';
export interface DebtEntry {
  key: string;
  id: string;
  kind: DebtKind;
  side: DebtSide;
  person: string;
  title: string;
  note: string;
  accountId: string;
  occurredAt: string;
  dueAt: string | null;
  remaining: number;
  monthly: ReturnType<typeof loanMonthlyPayment>;
}
export interface DebtSection {
  key: string;
  title: string;
  remaining: number;
  data: DebtEntry[];
}
export const debtKindLabels: Record<DebtKind, string> = {
  lend: 'Cho vay',
  borrow: 'Đi vay',
  purchase: 'Mua hộ',
};

// A shared view over existing records: loans and purchases keep their own
// repayment history and accounting rules.
export function createDebtEntries(ledger: Ledger): DebtEntry[] {
  const loans = loanBalances(ledger);
  const purchases = purchaseBalances(ledger);
  return [
    ...(ledger.loans ?? []).map((loan): DebtEntry => {
      const kind = loan.direction ?? 'borrow';
      return {
        key: `loan:${loan.id}`,
        id: loan.id,
        kind,
        side: kind === 'lend' ? 'receivable' : 'payable',
        person: loan.lender.trim(),
        title: debtKindLabels[kind],
        note: loan.note,
        accountId: loan.account_id,
        occurredAt: loan.occurred_at,
        dueAt: loan.due_at ?? null,
        remaining: loans.get(loan.id) ?? 0,
        monthly: loanMonthlyPayment(loan),
      };
    }),
    ...(ledger.purchases ?? []).map((purchase): DebtEntry => ({
      key: `purchase:${purchase.id}`,
      id: purchase.id,
      kind: 'purchase',
      side: 'receivable',
      person: purchase.person.trim(),
      title: purchase.title,
      note: purchase.note,
      accountId: purchase.account_id,
      occurredAt: purchase.occurred_at,
      dueAt: purchase.due_at,
      remaining: purchases.get(purchase.id) ?? 0,
      monthly: null,
    })),
  ];
}

export function debtTotals(entries: DebtEntry[]) {
  const totals = { receivable: 0, payable: 0, lend: 0, borrow: 0, purchase: 0 };
  for (const entry of entries) {
    totals[entry.side] = safeAdd(totals[entry.side], entry.remaining);
    totals[entry.kind] = safeAdd(totals[entry.kind], entry.remaining);
  }
  return totals;
}

export function groupDebts(
  entries: DebtEntry[],
  filters: {
    side: DebtSide;
    kind: DebtKind | '';
    status: 'open' | 'settled' | '';
    search: string;
  },
): DebtSection[] {
  const query = filters.search.trim().toLocaleLowerCase('vi-VN');
  const people = new Map<string, DebtSection>();
  for (const entry of entries) {
    if (
      entry.side !== filters.side ||
      (filters.kind && entry.kind !== filters.kind) ||
      (filters.status === 'open' && entry.remaining <= 0) ||
      (filters.status === 'settled' && entry.remaining !== 0) ||
      (query &&
        !`${entry.person} ${entry.title} ${entry.note}`
          .toLocaleLowerCase('vi-VN')
          .includes(query))
    )
      continue;
    const key = entry.person.toLocaleLowerCase('vi-VN');
    const group = people.get(key) ?? {
      key,
      title: entry.person,
      remaining: 0,
      data: [],
    };
    group.remaining = safeAdd(group.remaining, entry.remaining);
    group.data.push(entry);
    people.set(key, group);
  }
  return [...people.values()]
    .map((group) => ({
      ...group,
      data: group.data.sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) ||
          a.key.localeCompare(b.key),
      ),
    }))
    .sort(
      (a, b) =>
        b.remaining - a.remaining || a.title.localeCompare(b.title, 'vi'),
    );
}
