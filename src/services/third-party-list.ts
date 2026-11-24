import type { Filters, Ledger } from '../types/finance.ts';
import type {
  ThirdPartyFinancialStatus,
  ThirdPartyStatus,
} from '../types/third-party.ts';
import { periodRange } from './accounting/ledger.ts';
import {
  thirdPartyBalances,
  thirdPartyEntryLabels,
  thirdPartyEntryOrder,
} from './third-party.ts';
import { transactionTagIds } from './tags.ts';

export function filterThirdPartyCases(
  ledger: Ledger,
  filters: {
    search: string;
    person: string;
    status: ThirdPartyStatus | '';
    financial: ThirdPartyFinancialStatus | 'unresolved' | '';
    range?: [Date, Date];
    tags?: string[];
  },
) {
  const balances = thirdPartyBalances(ledger);
  const query = filters.search.trim().toLocaleLowerCase('vi-VN');
  const tags = new Set(filters.tags ?? []);
  return (ledger.thirdPartyCases ?? [])
    .filter((item) => {
      const balance = balances.get(item.id)!;
      const date = new Date(item.started_at);
      return (
        (!query ||
          `${item.title} ${item.person} ${item.description} ${item.note}`
            .toLocaleLowerCase('vi-VN')
            .includes(query)) &&
        (!filters.person || item.person === filters.person) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.financial ||
          (filters.financial === 'unresolved'
            ? balance.difference !== 0
            : balance.financialStatus === filters.financial)) &&
        (!filters.range ||
          (date >= filters.range[0] && date < filters.range[1])) &&
        (!tags.size || transactionTagIds(item).some((id) => tags.has(id)))
      );
    })
    .sort(
      (a, b) =>
        b.started_at.localeCompare(a.started_at) || a.id.localeCompare(b.id),
    );
}
export function filterThirdPartyEntries(ledger: Ledger, filters: Filters) {
  const [start, end] = periodRange(filters.date, filters.period);
  const cases = new Map(
    (ledger.thirdPartyCases ?? []).map((item) => [item.id, item]),
  );
  const query = filters.search.trim().toLocaleLowerCase('vi-VN');
  const accounts = new Set(
    filters.accounts?.length
      ? filters.accounts
      : filters.account
        ? [filters.account]
        : [],
  );
  const tags = new Set(filters.tags ?? []);
  return (ledger.thirdPartyEntries ?? [])
    .filter((entry) => {
      const item = cases.get(entry.case_id);
      const date = new Date(entry.occurred_at);
      return (
        date >= start &&
        date < end &&
        (!accounts.size || accounts.has(entry.account_id ?? '')) &&
        (!tags.size || transactionTagIds(entry).some((id) => tags.has(id))) &&
        (filters.minAmount === undefined ||
          entry.amount >= filters.minAmount) &&
        (filters.maxAmount === undefined ||
          entry.amount <= filters.maxAmount) &&
        (!query ||
          `${item?.title} ${item?.person} ${entry.note} ${thirdPartyEntryLabels[entry.kind]}`
            .toLocaleLowerCase('vi-VN')
            .includes(query))
      );
    })
    .sort((a, b) => thirdPartyEntryOrder(b, a));
}
