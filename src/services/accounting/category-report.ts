import type { Category } from '../../types/finance.ts';
import { categoryTree } from '../categories/hierarchy.ts';
import { safeAdd } from './ledger.ts';

// Label totals already deduplicate each transaction within an ancestor. Legacy allocations can be summed from leaves.
export function categoryReportRows(
  categories: Category[],
  amounts: Record<string, number>,
  parentId: string | null,
  inclusiveAmounts?: Record<string, number>,
) {
  const totals = { ...(inclusiveAmounts ?? amounts) };
  const tree = categoryTree(categories);
  if (!inclusiveAmounts)
    for (const { category: c } of [...tree].reverse()) {
      if (c.parent_id)
        totals[c.parent_id] = safeAdd(
          totals[c.parent_id] ?? 0,
          totals[c.id] ?? 0,
        );
    }
  const rows = tree
    .filter(({ category: c }) => (c.parent_id ?? null) === parentId)
    .map(({ category: c }) => ({ ...c, amount: totals[c.id] ?? 0 }));
  const parent = categories.find((c) => c.id === parentId);
  if (parent && (amounts[parent.id] ?? 0) > 0)
    rows.push({
      ...parent,
      name: `${parent.name} (ghi trực tiếp)`,
      amount: amounts[parent.id],
    });
  return rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
}
