import type { Ledger } from '../../types/finance.ts';
import { itemCategoryIds, transactionCategoryTags } from './tags.ts';

// Flatten names and IDs in place; category choice never changes transaction money.
export function singleCategoryLedger<T extends Ledger>(ledger: T): T {
  const splitIds = new Set(
    ledger.transactions.filter((t) => t.category_split === 1).map((t) => t.id),
  );
  const firstItems = new Map<string, string>();
  for (const item of [...ledger.items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  ))
    if (!firstItems.has(item.transaction_id))
      firstItems.set(item.transaction_id, item.category_id);
  return {
    ...ledger,
    categories: ledger.categories.map((c) => ({ ...c, parent_id: null })),
    transactions: ledger.transactions.map((t) => ({
      ...t,
      category_id:
        t.type === 'transfer'
          ? null
          : !splitIds.has(t.id) && firstItems.has(t.id)
            ? null
            : (transactionCategoryTags(t)[0] ??
              t.category_id ??
              firstItems.get(t.id) ??
              null),
      category_split: 0,
      category_ids_json: '[]',
    })),
    items: ledger.items
      .filter((item) => !splitIds.has(item.transaction_id))
      .map((item) => ({
        ...item,
        category_id: itemCategoryIds(item)[0],
        category_ids_json: '[]',
      })),
  };
}
